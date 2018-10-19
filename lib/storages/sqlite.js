const _ = require('lodash')
const Sequelize = require('sequelize')

const METRICS = ['first-contentful-paint', 'speed-index', 'interactive']
const TIMINGS = ['total']
const TIMING_BREAKDOWNS = []

const dataPointModel = [
  'data_points',
  {
    id: {type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},

    name: Sequelize.STRING(80),
    type: Sequelize.ENUM({values: ['metric', 'timing-breakdown', 'timing']}),
    value: Sequelize.DOUBLE(11, 12),

    url: Sequelize.STRING(256),
    runId: Sequelize.STRING(256),
    batchId: Sequelize.STRING(80),
    batchTime: Sequelize.DATE,
    label: Sequelize.STRING(80),
    hash: Sequelize.STRING(80),
  },
  {
    indexes: [
      {
        name: 'batch',
        method: 'BTREE',
        fields: ['batchId'],
      },
      {
        name: 'label_url',
        method: 'BTREE',
        fields: ['label', 'url'],
      },
    ],
  },
]

async function build(storageOptions) {
  const sequelize = new Sequelize(
    storageOptions.database,
    storageOptions.user,
    storageOptions.password,
    {dialect: 'sqlite', storage: storageOptions.path},
  )

  const DataPoint = sequelize.define(...dataPointModel)

  await sequelize.sync()

  return {sequelize, DataPoint}
}

module.exports = {
  build,
  dataPointModel,
  defaults: {
    host: 'localhost',
    database: 'dzl-lighthouse',
  },
  async run(lhrs, {batchId, label, hash, storageOptions}) {
    const {DataPoint} = await build(storageOptions)

    const rows = []
    const batchTime = new Date().toISOString()
    for (const item of lhrs) {
      const lhr = item._raw
      const url = lhr.requestedUrl
      const runIdPrefix = url.replace(/(https?|[^a-z]+)/g, '').slice(0, 40)
      const runId = `${runIdPrefix}-${Date.now()}`
      const baseRow = {url, runId, batchId, batchTime, label, hash}

      for (const name of METRICS) {
        const value = lhr.audits[name].rawValue
        rows.push({...baseRow, name, value, type: 'metric'})
      }

      for (const name of TIMINGS) {
        const value = lhr.timing[name]
        rows.push({...baseRow, name: `timing-${name}`, value, type: 'timing'})
      }

      for (const name of TIMING_BREAKDOWNS) {
        const value = lhr.timing[name]
        rows.push({...baseRow, name: `timing-${name}`, value, type: 'timing-breakdown'})
      }
    }

    await DataPoint.bulkCreate(rows)
  },
}
