const _ = require('lodash')
const Sequelize = require('sequelize')

const METRICS = ['first-contentful-paint', 'speed-index', 'interactive']
const TIMINGS = ['total', 'total-minus-load', 'lh:gather:afterPass', 'lh:runner:auditing']

const dataPointModel = [
  'data_points',
  {
    id: {type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},

    name: Sequelize.STRING(80),
    type: Sequelize.ENUM({values: ['metric', 'timing-breakdown', 'timing']}),
    value: Sequelize.DOUBLE(12, 12),

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
        name: 'batchtime',
        method: 'BTREE',
        fields: ['batchTime'],
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
  const logging = msg => console.log(msg.slice(0, 240))
  const sequelize = new Sequelize(
    storageOptions.database,
    storageOptions.user,
    storageOptions.password,
    storageOptions.path
      ? {dialect: 'sqlite', storage: storageOptions.path, logging}
      : {dialect: 'mysql', host: storageOptions.host, logging},
  )

  const DataPoint = sequelize.define(...dataPointModel)

  await sequelize.sync()

  return {sequelize, DataPoint}
}

function cleanTimingName(name) {
  return name
    .toLowerCase()
    .replace('lh:', '')
    .replace(/[^a-z]+/g, '-')
}

module.exports = {
  build,
  dataPointModel,
  defaults: {
    host: 'localhost',
    database: 'dzl_lighthouse',
    user: 'dzl',
    password: 'lighthouse',
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
        rows.push({...baseRow, name: `timing-${cleanTimingName(name)}`, value, type: 'timing'})
      }

      for (const [name, value] of Object.entries(lhr.timing)) {
        if (!name.startsWith('lh:')) continue
        const rowName = cleanTimingName(name)
        rows.push({...baseRow, name: `timing-${rowName}`, value, type: 'timing-breakdown'})
      }
    }

    const batches = _.chunk(rows, 20)
    for (const batch of batches) {
      await DataPoint.bulkCreate(batch)
    }
  },
}
