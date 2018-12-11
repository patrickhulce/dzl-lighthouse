const _ = require('lodash')
const Sequelize = require('sequelize')

const METRICS = ['first-contentful-paint', 'speed-index', 'interactive']
const TIMINGS = ['total', 'total-minus-load', 'lh:gather:afterPass', 'lh:runner:auditing']

const sharedAttributes = {
  id: {type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},

  url: Sequelize.STRING(256),
  runId: Sequelize.STRING(256),
  batchId: Sequelize.STRING(80),
  batchTime: Sequelize.DATE,
  label: Sequelize.STRING(80),
  hash: Sequelize.STRING(80),
}

const sharedIndexes = [
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
  {
    name: 'label_batch_id_time',
    method: 'BTREE',
    fields: ['label', 'batchId', 'batchTime'],
  },
]

const requestModel = [
  'requests',
  {
    id: {type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},
    url: Sequelize.STRING(256),
    hashA: Sequelize.STRING(80),
    hashB: Sequelize.STRING(80),
    status: Sequelize.STRING(40),
  },
  {},
]

const batchModel = [
  'batches',
  _.omit(sharedAttributes, ['url', 'runId']),
  {
    indexes: [
      {
        name: 'batches_batchid',
        method: 'HASH',
        fields: ['batchId'],
      },
      {
        name: 'batches_label_time',
        method: 'BTREE',
        fields: ['label', 'batchTime'],
      },
    ],
  },
]

const dataPointModel = [
  'data_points',
  {
    ...sharedAttributes,

    name: Sequelize.STRING(80),
    type: Sequelize.STRING(32),
    value: Sequelize.DOUBLE(12, 4),
  },
  {
    indexes: [
      ...sharedIndexes,
      {
        name: 'data_query',
        method: 'BTREE',
        fields: ['batchId', 'type', 'url', 'name', 'value'],
      },
    ],
  },
]

const rawModel = [
  'lhrs',
  {
    ...sharedAttributes,
    lhr: Sequelize.TEXT('long'),
  },
  {
    indexes: [...sharedIndexes].map(o => ({...o, name: `lhrs_${o.name}`})),
  },
]

async function build(storageOptions) {
  const logging = storageOptions.logging || (msg => console.error(msg.slice(0, 500)))
  const sequelize = new Sequelize(
    storageOptions.database,
    storageOptions.user,
    storageOptions.password,
    storageOptions.path
      ? {dialect: 'sqlite', storage: storageOptions.path, logging}
      : {dialect: 'mysql', host: storageOptions.host, logging},
  )

  const DataPoint = sequelize.define(...dataPointModel)
  const LHR = sequelize.define(...rawModel)
  const Batch = sequelize.define(...batchModel)
  const Request = sequelize.define(...requestModel)

  await sequelize.sync()

  return {sequelize, DataPoint, LHR, Batch, Request}
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
    const {DataPoint, LHR} = await build(storageOptions)

    const dataPoints = []
    const lhrRows = []
    const batchTime = new Date().toISOString()
    for (const item of lhrs) {
      const lhr = item._raw
      const url = lhr.requestedUrl
      const runIdPrefix = url.replace(/(https?|[^a-z]+)/g, '').slice(0, 40)
      const runId = `${runIdPrefix}-${Date.now()}`
      const baseRow = {url, runId, batchId, batchTime, label, hash}

      for (const name of METRICS) {
        let value = lhr.audits[name].rawValue
        if (!value) value = _.get(lhr.audits.metrics, ['details', 'items', '0', _.camelCase(name)])
        dataPoints.push({...baseRow, name, value, type: 'metric'})
      }

      for (const name of TIMINGS) {
        const value = lhr.timing[name]
        const rowName = cleanTimingName(name)
        dataPoints.push({...baseRow, name: `timing-${rowName}`, value, type: 'timing'})
      }

      for (const [name, value] of Object.entries(lhr.timing)) {
        if (!name.startsWith('lh:')) continue
        const rowName = cleanTimingName(name)
        dataPoints.push({...baseRow, name: `timing-${rowName}`, value, type: 'timing-breakdown'})
        delete lhr.timing[name]
      }

      for (const [id, result] of Object.entries(lhr.audits)) {
        const value = result.score
        dataPoints.push({...baseRow, name: `audit-score-${id}`, value, type: 'audit-score'})
      }

      lhrRows.push({...baseRow, lhr: JSON.stringify(lhr).replace(/[^\x00-\x7F]/g, '')})

      for (const row of dataPoints) {
        if (!Number.isFinite(row.value)) row.value = undefined
      }
    }

    const dpBatches = _.chunk(dataPoints, 100)
    for (const batch of dpBatches) {
      await DataPoint.bulkCreate(batch)
    }

    try {
      await LHR.bulkCreate(lhrRows)
    } catch (err) {
      console.error(err.message.slice(0, 200))
    }
  },
  async wrapup({batchId, label, hash, storageOptions}) {
    const {Batch} = await build(storageOptions)
    const batchTime = new Date().toISOString()
    const batch = {batchId, batchTime, label, hash}
    await Batch.create(batch)
  },
}
