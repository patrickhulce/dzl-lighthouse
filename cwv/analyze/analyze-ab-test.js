const fs = require('fs-extra')
const path = require('path')
const thirdPartyWeb = require('third-party-web')
const _ = require('lodash')

const DATA_FOLDER = path.join(__dirname, '../collection/data')

const METRICS_TO_USE = new Set([
  'firstContentfulPaint',
  'firstMeaningfulPaint',
  'largestContentfulPaint',
  'firstCPUIdle',
  'interactive',
  'speedIndex',
  'estimatedInputLatency',
  'totalBlockingTime',
  'maxPotentialFID',
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
        dataset.push({
          url: lhr.requestedUrl,
          entityDomain,
          blocked: runName.includes('blocked'),
          index: Number(runName.split('-')[0]),
          pathOnDisk,
          metrics: _.get(lhr, 'audits.metrics.details.items[0]'),
        })
      }
    }
  }

  return dataset
}

/** @param {Array<DataItem>} items */
function processIntoRows(items) {
  /** @type {string[]} */
  const headers = ['Entity', 'URL', 'Delta']
  const byEntity = Object.values(_.groupBy(items, (item) => item.entityDomain))
  const rows = _.flatten(
    byEntity.map((group) => Object.values(_.groupBy(group, (item) => item.url))),
  )

  const mappedRows = rows.map((row) => {
    const regularItems = row.filter((item) => !item.blocked)
    const blockedItems = row.filter((item) => item.blocked)

    const data = [thirdPartyWeb.getEntity(row[0].entityDomain).name, row[0].url, 0]
    const deltas = []

    for (const key of Object.keys(row[0].metrics)) {
      if (!METRICS_TO_USE.has(key)) continue

      const keyFn = (item) => item.metrics[key]
      deltas.push(
        _.mean(blockedItems.map(keyFn) - _.mean(regularItems.map(keyFn))) *
          (key === 'cumulativeLayoutShift'
            ? 3000
            : key === 'totalBlockingTime'
            ? 10
            : key === 'maxPotentialFID'
            ? 10
            : 1),
      )
      data.push(
        _.min(regularItems.map(keyFn)),
        _.mean(regularItems.map(keyFn)),
        _.max(regularItems.map(keyFn)),
        _.min(blockedItems.map(keyFn)),
        _.mean(blockedItems.map(keyFn)),
        _.max(blockedItems.map(keyFn)),
        _.mean(blockedItems.map(keyFn)) - _.mean(regularItems.map(keyFn)),
      )

      if (headers.length < data.length) {
        headers.push(`${key} Min`)
        headers.push(`${key} Mean`)
        headers.push(`${key} Max`)
        headers.push(`${key} Min (Blocked)`)
        headers.push(`${key} Mean (Blocked)`)
        headers.push(`${key} Max (Blocked)`)
        headers.push(`${key} Delta`)
      }
    }

    data[2] = _.mean(deltas)
    return data
  })

  return [headers, ...mappedRows]
}

process.stdout.write(
  processIntoRows(readDataset())
    .map((row) => row.join(','))
    .join('\n'),
)
