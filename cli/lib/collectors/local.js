const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const execa = require('execa')
const tcpPortUsed = require('tcp-port-used')

function getPaths(collectorOptions) {
  const cwd = path.resolve(process.cwd(), collectorOptions.repositoryPath)
  const configPath = path.resolve(cwd, 'config.json')
  return {cwd, configPath}
}

function getPrecomputedLanternDataPath(cwd, url) {
  const cleanURL = url
    .replace(/[^a-z0-9]+/gi, '')
    .replace(/^https?/, '')
    .slice(0, 40)
  return path.join(cwd, `lantern-data-${cleanURL}.json`)
}

async function uploadAssetsToGoogleStorage(batchId, preAssets, postAssets) {
  if (!process.env.SAVE_ASSETS) return

  const newAssets = _.difference(postAssets, preAssets).filter(
    a => a.includes('.devtools') || a.includes('.trace'),
  )

  for (const asset of newAssets) {
    const base = path.basename(asset)
    process.stdout.write(`uploading ${base} to cloud storage...`)
    await execa('gsutil', ['cp', asset, `gs://dzl-assets/${batchId}/${base}`], {
      env: {...process.env, BOTO_CONFIG: '/dev/null'},
    })
    fs.unlinkSync(asset)
    process.stdout.write(`done!\n`)
  }
}

/**
 * Runs a local Lighthouse checkout, requires...
 *   - the repository to be checked out in a clean state
 *   - yarn to be installed globally
 */
module.exports = {
  defaults: {
    repositoryPath: path.join(__dirname, '../../.tmp/lighthouse'),
  },
  async setup({hash, lighthouseConfig, collectorOptions}) {
    const {cwd, configPath} = getPaths(collectorOptions)
    // Update to make sure we have latest from origin
    await execa('git', ['fetch', 'origin'], {cwd})
    // Checkout the specified hash
    await execa('git', ['checkout', '-f', hash], {cwd})
    // Make sure lighthouse is built
    // await execa('yarn', [], {cwd})
    // await execa('yarn', ['install-all'], {cwd})
    // Write the config file to disk
    fs.writeFileSync(configPath, JSON.stringify(lighthouseConfig, null, 2))
  },
  async run({url, collectorOptions, batchId}) {
    const {cwd, configPath} = getPaths(collectorOptions)
    const lanternDataPath = getPrecomputedLanternDataPath(cwd, url)
    let lanternDataFlags = ['--lantern-data-output-path', lanternDataPath]
    if (fs.existsSync(lanternDataPath))
      lanternDataFlags = ['--precomputed-lantern-data-path', lanternDataPath]

    let extraChromeFlags = ''
    if (collectorOptions.wpr && (await tcpPortUsed.check(8780, '127.0.0.1')))
      extraChromeFlags += [
        `--host-resolver-rules="MAP *:80 127.0.0.1:8780,MAP *:443 127.0.0.1:8781,EXCLUDE localhost"`,
        `--ignore-certificate-errors-spki-list="PhrPvGIaAMmd29hj8BCZOq096yj7uMpRNHpn5PDxI6I="`,
      ].join(' ')

    if (collectorOptions.headless) extraChromeFlags += ' --headless'

    let chromeFlagsArgs = []
    if (extraChromeFlags) chromeFlagsArgs = [`--chrome-flags=${extraChromeFlags}`]

    let saveAssetsFlags = []
    if (process.env.SAVE_ASSETS) saveAssetsFlags = ['--save-assets']

    const preAssets = fs.readdirSync(cwd).map(p => path.join(cwd, p))
    const results = await execa(
      './lighthouse-cli/index.js',
      [
        url,
        '--config-path',
        configPath,
        '--output',
        'json',
        ...lanternDataFlags,
        ...chromeFlagsArgs,
        ...saveAssetsFlags,
      ],
      {cwd},
    )

    const postAssets = fs.readdirSync(cwd).map(p => path.join(cwd, p))
    if (process.env.SAVE_ASSETS) await uploadAssetsToGoogleStorage(batchId, preAssets, postAssets)

    return JSON.parse(results.stdout)
  },
  afterEach() {},
}
