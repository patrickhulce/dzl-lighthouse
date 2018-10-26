const _ = require('lodash')
const util = require('util')
const fs = require('fs')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const storage = require(`../storages/sqlite`)

const readFile = util.promisify(fs.readFile)
const staticDir = path.join(__dirname, '../www')

module.exports = async function serve(args) {
  const config = args.config
  const storageOptions = _.merge(_.cloneDeep(storage.defaults), config.storage)
  const {DataPoint} = await storage.build(storageOptions)

  const app = express()
  app.use(bodyParser.json())

  app.get('/', async (req, res) => {
    const indexHTML = await readFile(path.join(staticDir, 'index.html'), 'utf8')
    const pageHTML = await readFile(path.join(staticDir, 'dashboard.html'), 'utf8')
    const mergedHTML = indexHTML.replace('<!-- INJECT_HERE -->', pageHTML)
    res.end(mergedHTML)
  })

  app.use(express.static(staticDir))

  app.get('/dashboard-data.json', async (req, res) => {
    const data = await DataPoint.findAll({
      where: {
        label: 'local',
      },
      attributes: ['name', 'value', 'url', 'batchId'],
    })

    const groups = _(data)
      .groupBy('batchId')
      .mapValues(values =>
        _(values)
          .groupBy('url')
          .mapValues(values =>
            _(values)
              .groupBy('name')
              .mapValues(items => items.map(item => item.value))
              .value(),
          )
          .value(),
      )
      .value()

    res.json(groups)
  })

  app.listen(args.port, () => process.stdout.write(`Server listening on port ${args.port}`))
}
