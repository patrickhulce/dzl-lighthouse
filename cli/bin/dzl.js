#!/usr/bin/env node

const path = require('path')
const yargs = require('yargs')
const execa = require('execa')
const commands = require('../lib/commands')
const Promise = require('bluebird')

const args = yargs
  .command('collect', 'run Lighthouse to collect data', {
    hash: {
      type: 'string',
      default: 'HEAD',
    },
    label: {
      type: 'string',
      default: 'local',
    },
    batchId: {
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
    childProcessConcurrency: {
      type: 'number',
      default: 1,
    },
    skipSetup: {
      type: 'boolean',
    },
    config: {
      type: 'string',
      default: 'agent.config.js',
    },
  })
  .command('serve', 'run the web server', {
    port: {
      type: 'number',
      default: 8088,
    },
    config: {
      type: 'string',
      default: 'agent.config.js',
    },
  })
  .command('requests', 'manipulate ondemand requests', {
    logging: {
      type: 'boolean',
      default: false,
    },
    config: {
      type: 'string',
      default: 'agent.config.js',
    },
    action: {
      type: 'string',
      choices: ['get', 'update'],
      default: 'get',
    },
    requestId: {
      type: 'number',
      default: Number(process.env.REQUEST_ID),
    },
    status: {
      type: 'string',
      choices: ['started', 'finished', 'failed'],
      default: 'started',
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
  const collectionPromise = commands.collect(args)

  try {
    if (spawnExtraChildren) {
      const startAtIndexes = []
      for (let i = 0; i < Math.ceil(allURLs.length / args.limit); i++)
        startAtIndexes.push(i * args.limit)

      let totalFailures = 0
      await Promise.map(
        startAtIndexes,
        async startAtIndex => {
          if (startAtIndex === 0) return collectionPromise
          if (totalFailures > 4) throw new Error('More than 4 failures, aborting...')

          try {
            console.log(
              'Running',
              startAtIndex,
              'to',
              startAtIndex + args.limit,
              'in child process',
            )
            const mappedArgs = replaceStartAt(process.argv.slice(1), startAtIndex)
            mappedArgs.push('--batchId', args.batchId)
            await execa(process.argv[0], mappedArgs, {stdio: 'inherit'})
          } catch (err) {
            console.error('Index', startAtIndex, 'failed!!', err)
            totalFailures++
          }
        },
        {concurrency: args.childProcessConcurrency},
      )
    }

    await collectionPromise
  } catch (err) {
    throw err
  } finally {
    if (startAt === 0) await commands.collect({...args, isWrapup: true})
  }
}

async function serve() {
  args.configPath = args.config
  args.config = require(path.resolve(process.cwd(), args.config))
  await commands.serve(args)
}

async function requests() {
  args.configPath = args.config
  args.config = require(path.resolve(process.cwd(), args.config))
  await commands.requests(args)
}

async function run() {
  switch (args._[0]) {
    case 'collect':
      await collect()
      process.exit(0)
      break
    case 'serve':
      await serve()
      break
    case 'requests':
      await requests()
      process.exit(0)
      break
    default:
      throw new Error(`Unrecognized command ${args._[0]}`)
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
