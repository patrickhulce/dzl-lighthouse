const fs = require('fs-extra')
const path = require('path')
const thirdPartyWeb = require('third-party-web')
const _ = require('lodash')

const DATA_FOLDER = path.join(__dirname, '../collection/data')

const METRICS_TO_USE = new Set([
  'performance',
  'firstContentfulPaint',
  'largestContentfulPaint',
  'interactive',
  'speedIndex',
  'totalBlockingTime',
  'cumulativeLayoutShift',
])

/**
 * @typedef DataItem
 * @property {string} url
 * @property {string} entityDomain
 * @property {boolean} blocked
 * @property {number} index
 * @property {string} pathOnDisk
 * @property {Record<string, number>} metrics
 */

/** @return {Array<DataItem>} */
function readDataset() {
  let earliestDate = Date.now()
  let latestDate = 0
  /** @type {Array<DataItem>} */
  const dataset = []

  for (const instanceName of fs.readdirSync(DATA_FOLDER)) {
    const instanceFolderPath = path.join(DATA_FOLDER, instanceName)
    if (!fs.statSync(instanceFolderPath).isDirectory()) continue

    const entityDomain = fs.readFileSync(path.join(instanceFolderPath, 'entity.txt'), 'utf8').trim()
    for (const urlName of fs.readdirSync(instanceFolderPath)) {
      const urlFolderPath = path.join(instanceFolderPath, urlName)
      if (!fs.statSync(urlFolderPath).isDirectory()) continue

      for (const runName of fs.readdirSync(urlFolderPath)) {
        if (process.env.QUICK && !/^(0|1|2)-/.test(runName)) continue

        console.error('Reading', runName, 'of', urlName, '...')
        const pathOnDisk = path.join(urlFolderPath, runName)
        const lhr = JSON.parse(fs.readFileSync(path.join(pathOnDisk, 'lhr.json'), 'utf8'))
        const fetchTimeIso = _.get(lhr, 'fetchTime')
        const fetchTimeMs = new Date(fetchTimeIso).getTime()
        if (fetchTimeMs) earliestDate = Math.min(fetchTimeMs, earliestDate)
        if (fetchTimeMs) latestDate = Math.max(fetchTimeMs, latestDate)
        dataset.push({
          url: lhr.requestedUrl,
          entityDomain,
          blocked: runName.includes('blocked'),
          index: Number(runName.split('-')[0]),
          pathOnDisk,
          dateCollected: fetchTimeIso,
          metrics: {
            performance: _.get(lhr, 'categories.performance.score'),
            ..._.get(lhr, 'audits.metrics.details.items[0]'),
          },
        })
      }
    }
  }

  console.warn('Collection took', Math.round((latestDate - earliestDate) / 60e3), 'minutes')
  return dataset
}

/** @param {Array<DataItem>} items */
function processIntoRows(items) {
  /** @type {string[]} */
  const headers = ['Entity', 'URL', 'Impact']
  const byEntity = Object.values(_.groupBy(items, (item) => item.entityDomain))
  const rows = _.flatten(
    byEntity.map((group) => Object.values(_.groupBy(group, (item) => item.url))),
  )

  const mappedRows = rows.map((row) => {
    const regularItems = row.filter((item) => !item.blocked)
    const blockedItems = row.filter((item) => item.blocked)
    const stddev = (items, mean) =>
      Math.sqrt(_.sum(items.map((x) => Math.pow(x - mean, 2))) / Math.max(items.length - 1, 1))

    let isInvalid = false
    const data = [thirdPartyWeb.getEntity(row[0].entityDomain).name, row[0].url, 0]
    const deltas = []

    for (const key of Object.keys(row[0].metrics)) {
      if (!METRICS_TO_USE.has(key)) continue
      if (row.some((item) => !Number.isFinite(item.metrics[key]))) {
        isInvalid = true
        console.warn(`${row[0].url} had invalid ${key}, skipping...`)
        break
      }

      const keyFn = (item) => item.metrics[key]
      const regularMean = _.mean(regularItems.map(keyFn))
      const blockedMean = _.mean(blockedItems.map(keyFn))
      deltas.push(
        (regularMean - blockedMean) *
          (key === 'cumulativeLayoutShift'
            ? 5000
            : key === 'performance'
            ? -5000
            : key === 'totalBlockingTime'
            ? 2
            : 1),
      )

      data.push(
        _.min(regularItems.map(keyFn)),
        regularMean,
        _.max(regularItems.map(keyFn)),
        stddev(regularItems.map(keyFn), regularMean),
        _.min(blockedItems.map(keyFn)),
        blockedMean,
        _.max(blockedItems.map(keyFn)),
        stddev(blockedItems.map(keyFn), blockedMean),
        regularMean - blockedMean,
      )

      if (headers.length < data.length) {
        headers.push(`${key} Min`)
        headers.push(`${key} Mean`)
        headers.push(`${key} Max`)
        headers.push(`${key} Stddev`)
        headers.push(`${key} Min (Blocked)`)
        headers.push(`${key} Mean (Blocked)`)
        headers.push(`${key} Max (Blocked)`)
        headers.push(`${key} Stddev (Blocked)`)
        headers.push(`${key} Impact`)
      }
    }

    data[2] = _.mean(deltas)
    return isInvalid ? undefined : data
  })

  return [headers, ...mappedRows.filter(Boolean)]
}

process.stdout.write(
  processIntoRows(readDataset())
    .map((row) => row.join(','))
    .join('\n'),
)
