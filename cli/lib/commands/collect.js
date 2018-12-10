const _ = require('lodash')
const mapPromise = require('bluebird').map

function pruneLHR(lhr) {
  for (const {name, duration} of lhr.timing.entries || []) {
    lhr.timing[name] = (lhr.timing[name] || 0) + duration
  }

  lhr.timing['total-minus-load'] = lhr.timing.total - lhr.timing['lh:gather:loadPage-defaultPass']

  return {
    url: lhr.requestedUrl,
    durationTotal: lhr.timing.total,
    metricFirstContentfulPaint: lhr.audits['first-contentful-paint'].rawValue,
    metricInteractive: lhr.audits['interactive'].rawValue,
    metricSpeedIndex: lhr.audits['speed-index'].rawValue,
    _raw: lhr,
  }
}

module.exports = async function collect(args) {
  const {label, hash, config} = args
  const batchId = args.batchId || `${label}-${new Date().toISOString()}`
  args.batchId = batchId

  const collector = require(`../collectors/${config.collector.type}`)
  const storage = require(`../storages/${config.storage.type}`)

  const lighthouseConfig = config.lighthouseConfig
  const collectorOptions = _.merge(_.cloneDeep(collector.defaults), config.collector)
  const storageOptions = _.merge(_.cloneDeep(storage.defaults), config.storage)

  const options = {
    batchId,
    hash,
    label,
    storage,
    lighthouseConfig,
    collectorOptions,
    storageOptions,
  }

  if (args.isWrapup) return await storage.wrapup(options)

  if (!args.skipSetup) {
    console.log('Setting up collector')
    await collector.setup(options)
  } else {
    console.log('Skipping setup')
  }

  for (const url of config.collection.urls) {
    const copies = _.fill(new Array(config.collection.runs), url)

    const lhrs = await mapPromise(
      copies,
      async url => {
        console.log('Running collector on', url)

        let lhr
        try {
          lhr = await collector.run({url, ...options})
        } catch (err) {
          console.log('Run on', url, 'failed. Trying one more time')
          lhr = await collector.run({url, ...options})
        }

        await collector.afterEach()
        return pruneLHR(lhr)
      },
      {concurrency: args.concurrency},
    )

    await storage.run(lhrs, options)
    console.log('LHRs saved!')
  }
}
