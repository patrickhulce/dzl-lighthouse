#!/usr/bin/env node

const path = require('path')
const yargs = require('yargs')
const execFileSync = require('child_process').execFileSync
const commands = require('../lib/commands')

const args = yargs
  .command('collect', 'run Lighthouse to collect data', {
    hash: {
      type: 'string',
      default: 'master',
    },
    label: {
      type: 'string',
      default: 'local',
    },
    runId: {
      type: 'string',
    },
    limit: {
      type: 'number',
      default: 5,
    },
    startAt: {
      type: 'number',
      default: 0,
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

function replaceStartAt(tokens, newValue) {
  const regex = /start-?at/i
  const newTokens = []
  let isTokenToReplace = false
  let didReplacement = false
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]
    if (regex.test(token) && token.includes('=')) {
      token = `--start-at=${newValue}`
      didReplacement = true
    } else if (regex.test(token)) {
      isTokenToReplace = true
    } else if (isTokenToReplace) {
      token = newValue
      didReplacement = true
      isTokenToReplace = false
    }

    newTokens[i] = token
  }

  if (!didReplacement) newTokens.push(`--start-at=${newValue}`)
  return newTokens
}

async function collect() {
  args.configPath = args.config
  args.config = require(path.resolve(process.cwd(), args.config))

  const startAt = args.startAt
  const allURLs = args.config.collection.urls.slice()
  const runURLs = args.config.collection.urls.slice(startAt)
  const spawnExtraChildren = runURLs.length > args.limit && startAt === 0

  args.config.collection.urls = runURLs.slice(0, args.limit)
  await commands.collect(args)

  if (spawnExtraChildren) {
    for (let i = 1; i < Math.ceil(allURLs.length / args.limit); i++) {
      const nextStartAt = args.limit * i
      console.log('Running', nextStartAt, 'to', nextStartAt + args.limit, 'in child process')
      const mappedArgs = replaceStartAt(process.argv.slice(1), nextStartAt)
      mappedArgs.push('--runId', args.runId)
      execFileSync(process.argv[0], mappedArgs, {stdio: 'inherit'})
    }
  }
}

async function run() {
  switch (args._[0]) {
    case 'collect':
      await collect()
      break
    default:
      throw new Error(`Unrecognized command ${args._[0]}`)
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
