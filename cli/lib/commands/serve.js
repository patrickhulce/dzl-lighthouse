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

    async function getBatchData(where) {
      const metadataAttrs = ['batchId', 'hash', 'label']
      const [metadata, ...data] = await Promise.all([
        DataPoint.findAll({where, attributes: metadataAttrs, group: metadataAttrs}),
        DataPoint.findAll({
          where: _.omit(where, 'label'),
          attributes: ['name', 'value', 'url', 'batchId'],
        }),
      ])

      const groups = _(data)
        .flatten()
        .groupBy('batchId')
        .mapValues((values, batchId) => {
          const dataByURL = _(values)
            .groupBy('url')
            .mapValues(values =>
              _(values)
                .groupBy('name')
                .mapValues(items => items.map(item => item.value))
                .value(),
            )
            .value()

          dataByURL._metadata = _.find(metadata, {batchId})

          return dataByURL
        })
        .value()

      return groups
    }

    const where = {
      label: req.query.label || 'official-ci',
      type: {$notIn: ['timing-breakdown']},
    }

    let batchIds = await getBatchIDs(where)

    if (req.query.comparison) {
      where.label = {$or: [where.label, req.query.comparison, 'official-ci', 'official-continuous']}
      batchIds = batchIds.concat(await getBatchIDs({...where, label: req.query.comparison}))
    }

    console.log('Found batchIds', batchIds)
    res.json(await getBatchData({...where, batchId: {$in: batchIds}}))
  })

  app.listen(args.port, () => process.stdout.write(`Server listening on port ${args.port}`))
}
