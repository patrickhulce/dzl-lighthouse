const fs = require('fs')
const path = require('path')
const execa = require('execa')

function getPaths(collectorOptions) {
  const cwd = path.resolve(process.cwd(), collectorOptions.repositoryPath)
  const configPath = path.resolve(cwd, 'config.json')
  return {cwd, configPath}
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
  async run({url, collectorOptions}) {
    const {cwd, configPath} = getPaths(collectorOptions)

    const results = await execa(
      './lighthouse-cli/index.js',
      [
        url,
        '--config-path',
        configPath,
        '--output',
        'json',
        // '--chrome-flags="--headless"',
      ],
      {cwd},
    )

    return JSON.parse(results.stdout)
  },
  afterEach() {},
}
