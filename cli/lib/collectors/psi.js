const fs = require('fs')
const path = require('path')
const execa = require('execa')
const fetch = require('isomorphic-fetch')
const URLSearchParams = require('url').URLSearchParams

const PSI_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

function getURLForPSI(paramsMap) {
  const categories = paramsMap.category || ['performance', 'pwa', 'seo', 'best-practices']
  delete paramsMap.category

  const params = new URLSearchParams(paramsMap)
  for (const category of categories) {
    params.append('category', category)
  }

  return `${PSI_URL}?${params}`
}

async function getHashFromVersion(version, cwd) {
  try {
    return (await execa('git', ['rev-parse', version], {cwd})).stdout.trim()
  } catch (err) {}
}

/**
 * Runs a Lighthouse through PSI v5 API, requires...
 *   - the repository to be checked out in a clean state
 *   - the tag of the lighthouseVersion to be set on the GitHub repo
 */
module.exports = {
  defaults: {
    repositoryPath: path.join(__dirname, '../../.tmp/lighthouse'),
    apiKey: process.env.PSI_TOKEN || process.env.PSI_API_KEY,
  },
  async setup(options) {
    const {collectorOptions} = options

    // Find out the LH version of PSI
    const url = getURLForPSI({
      url: 'http://example.com',
      strategy: 'mobile',
      key: collectorOptions.apiKey,
      category: ['performance'],
    })
    const response = await fetch(url)
    if (response.status !== 200) {
      const text = await response.text()
      console.log(text)
      throw new Error('Could not find version of PSI')
    }

    const json = await response.json()

    // Walk back to the hash of LH
    // Update to make sure we have latest from origin
    const version = json.lighthouseResult.lighthouseVersion
    const cwd = path.resolve(process.cwd(), collectorOptions.repositoryPath)
    await execa('git', ['fetch', '--tags'], {cwd})
    const hash =
      (await getHashFromVersion(version, cwd)) ||
      (await getHashFromVersion(`v${version}`, cwd)) ||
      (await getHashFromVersion(version.replace(/\+.*$/, ''), cwd))

    if (!hash) throw new Error(`Could not deduce LH hash from ${version}`)
    options.hash = hash
  },
  async run({url, lighthouseConfig, collectorOptions}) {
    // Make sure we don't use a cached response
    await new Promise(resolve => setTimeout(resolve, 60 * 1000))

    const apiURL = getURLForPSI({
      url: url,
      strategy: 'mobile',
      key: collectorOptions.apiKey,
      category: lighthouseConfig.settings.onlyCategories,
    })

    const response = await fetch(apiURL)
    if (response.status !== 200) {
      const text = await response.text()
      console.log(text)
      throw new Error('Could not fetch PSI result')
    }

    const json = await response.json()
    return json.lighthouseResult
  },
  async afterEach() {
  },
}
