const _ = require('lodash')
const util = require('util')
const fs = require('fs')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const storage = require(`../storages/sql`)
const fetch = require('isomorphic-fetch')
const Sequelize = require('sequelize')
const Promise = require('bluebird')

const readFile = util.promisify(fs.readFile)
const staticDir = path.join(__dirname, '../www')
const cacheDir = path.join(__dirname, '../../.cache')
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir)

function pageHandler(fallbackPage) {
  return async (req, res) => {
    const page = req.query.page || fallbackPage
    const templateHTML = await readFile(path.join(staticDir, 'template.html'), 'utf8')
    const pageHTML = await readFile(path.join(staticDir, `${page}.html`), 'utf8')
    const scriptHTML = `<script defer src="${page}.js"></script>`
    const mergedHTML = templateHTML.replace('<!-- INJECT_HERE -->', pageHTML + scriptHTML)
    res.end(mergedHTML)
  }
}

module.exports = async function serve(args) {
  const config = args.config
  const storageOptions = _.merge(_.cloneDeep(storage.defaults), config.storage)
  const {DataPoint, Batch} = await storage.build(storageOptions)

  const app = express()
  app.use(bodyParser.json())

  app.get('/dashboard', pageHandler('dashboard'))
  app.get('/dashboard-by-url', pageHandler('by-url'))
  app.get('/dashboard-comparison', pageHandler('comparison'))

  app.use(express.static(staticDir))

  app.get('/dashboard-data.json', async (req, res) => {
    if (req.query.proxy && req.host === 'localhost') {
      const remotePath = req.originalUrl.replace('proxy=', 'origProxy=')
      const response = await fetch(`https://dzl.patrickhulce.com${remotePath}`)
      res.json(await response.json())
      return
    }

    async function getBatchIDs(where) {
      const response = await Batch.findAll({
        where: {label: where.label},
        attributes: ['batchId', 'batchTime'],
      })

      return response
        .sort((itemA, itemB) => itemB.batchTime.getTime() - itemA.batchTime.getTime())
        .slice(0, req.query.limit || 8)
        .map(item => item.batchId)
    }

    async function getSingleBatch(batchId) {
      const cleanBatch = batchId.replace(/[^a-z0-9]+/g, '_')
      const cacheFile = path.join(cacheDir, `${cleanBatch}.json`)
      if (fs.existsSync(cacheFile) && !req.query.force) {
        console.log('Using cached copy at', cacheFile)
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
      }

      const batchMetadata = (await Batch.find({where: {batchId}})).toJSON()
      const batchData = await DataPoint.findAll({
        where: {batchId},
        attributes: ['name', 'value', 'url', 'batchId'],
      })

      const batchDataByURL = _(batchData)
        .groupBy('url')
        .mapValues(values =>
          _(values)
            .groupBy('name')
            .mapValues(items => items.map(item => item.value))
            .value(),
        )
        .value()

      batchDataByURL._metadata = batchMetadata

      fs.writeFileSync(cacheFile, JSON.stringify(batchDataByURL, null, 2))
      return batchDataByURL
    }

    async function getBatchData(batchIds) {
      const batches = await Promise.all(batchIds.map(getSingleBatch))
      return _.keyBy(batches, batch => batch._metadata.batchId)
    }

    const where = {
      label: req.query.label || 'official-ci',
    }

    let batchIds = await getBatchIDs(where)

    if (req.query.comparison) {
      where.label = {$or: [where.label, req.query.comparison, 'official-ci', 'official-continuous']}
      batchIds = batchIds.concat(await getBatchIDs({...where, label: req.query.comparison}))
    }

    console.log('Found batchIds', batchIds)
    res.json(await getBatchData(batchIds))
  })

  app.listen(args.port, () => process.stdout.write(`Server listening on port ${args.port}`))
}
