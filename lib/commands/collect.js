const _ = require('lodash')
const path = require('path')
const mapPromise = require('bluebird').map

module.exports = async function collect(args) {
  const hash = args.hash
  const config = require(path.resolve(process.cwd(), args.config))

  const collector = require(`../collectors/${config.collector.type}`)
  const storage = require(`../storages/${config.storage.type}`)

  const lighthouseConfig = config.lighthouseConfig
  const collectorOptions = _.merge(_.cloneDeep(collector.defaults), config.collector)
  const storageOptions = _.merge(_.cloneDeep(storage.defaults), config.storage)

  const options = {hash, storage, lighthouseConfig, collectorOptions, storageOptions}

  if (!args.skipSetup) {
    console.log('Setting up collector')
    await collector.setup(options)
  } else {
    console.log('Skipping setup')
  }

  const urls = config.collection.urls
  for (let i = 1; i < config.collection.runs; i++) {
    urls.push(...config.collection.urls)
  }

  await mapPromise(
    urls,
    async url => {
      console.log('Running collector on', url)
      try {
        await collector.run({url, ...options})
      } catch (err) {
        console.log('Run on', url, 'failed. Trying one more time')
        await collector.run({url, ...options})
      }
    },
    {concurrency: args.concurrency},
  )
}
