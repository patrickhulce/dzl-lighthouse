const _ = require('lodash')
const Influx = require('influx')

const METRICS = ['Interactive', 'FirstContentfulPaint', 'SpeedIndex']

const schema = [
  {
    measurement: 'lhrs',
    tags: ['batchId', 'label', 'url', 'hash'],
    fields: {
      batchId: Influx.FieldType.STRING,
      label: Influx.FieldType.STRING,
      hash: Influx.FieldType.STRING,
      url: Influx.FieldType.STRING,
      durationTotal: Influx.FieldType.FLOAT,
      metricFirstContentfulPaint: Influx.FieldType.INTEGER,
      metricInteractive: Influx.FieldType.INTEGER,
      metricSpeedIndex: Influx.FieldType.INTEGER,
      metricFirstContentfulPaintPercentDiff: Influx.FieldType.FLOAT,
      metricInteractivePercentDiff: Influx.FieldType.FLOAT,
      metricSpeedIndexPercentDiff: Influx.FieldType.FLOAT,
      metricFirstContentfulPaintStddev: Influx.FieldType.FLOAT,
      metricInteractiveStddev: Influx.FieldType.FLOAT,
      metricSpeedIndexStddev: Influx.FieldType.FLOAT,
    },
  },
]

module.exports = {
  defaults: {
    host: 'localhost',
    database: 'dzl-lighthouse',
  },
  async run(lhrs, {batchId, label, hash, storageOptions}) {
    const influx = new Influx.InfluxDB({
      host: storageOptions.host,
      database: storageOptions.database,
      schema,
    })

    // Dropping the database in between runs is a good way to test during development
    // DANGER: DO NOT DO THIS IN PRODUCTION
    // await influx.dropDatabase(storageOptions.database)

    await influx.createDatabase(storageOptions.database)

    const timestampBase = Date.now()
    const points = _(lhrs)
      .groupBy('url')
      .flatMap(group => {
        for (const metricName of METRICS) {
          const key = `metric${metricName}`
          const N = group.length
          const mean = _.sumBy(group, key) / N
          const sumSquaredErr = _.sumBy(group, item => Math.pow((item[key] - mean) / mean, 2))
          const stddev = Math.sqrt(sumSquaredErr / (N - 1))

          for (const lhr of group) {
            const value = lhr[key]
            const percentDiff = (value - mean) / mean
            lhr[`${key}Stddev`] = stddev
            lhr[`${key}PercentDiff`] = percentDiff
          }
        }

        return group
      })
      .map((lhr, idx) => ({
        measurement: 'lhrs',
        tags: {batchId, label, hash, url: lhr.url},
        fields: {batchId, label, hash, ...lhr},
        // Use a manual timestamp so points with the same URL don't get dropped
        timestamp: new Date(timestampBase + idx),
      }))
      .value()

    await influx.writePoints(points)
  },
  async wrapup({batchId, label, hash, storageOptions}) {},
}
