#!/usr/bin/env node

const yargs = require('yargs')
const commands = require('../lib/commands')

const args = yargs
  .command('collect', 'run Lighthouse to collect data', {
    hash: {
      type: 'string',
      default: 'master',
    },
    label: {
      type: 'string',
      default: 'latest',
    },
    concurrency: {
      type: 'number',
      default: 2,
    },
    skipSetup: {
      type: 'boolean',
    },
    config: {
      type: 'string',
      required: true,
    },
  })
  .demandCommand().argv

async function run() {
  switch (args._[0]) {
    case 'collect':
      await commands.collect(args)
      break
    default:
      throw new Error(`Unrecognized command ${args._[0]}`)
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
