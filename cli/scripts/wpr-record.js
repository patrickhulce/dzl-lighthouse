#!/usr/bin/env node

const puppeteer = require('puppeteer')
const path = require('path')
const childProcess = require('child_process')
const psTree = require('ps-tree')
const officialConfig = require('../../ansible/templates/conf/agent-official.config.js')

const WPR_GO_PATH =
  process.env.WPR_GO_PATH ||
  path.join(process.env.HOME, 'go/src/github.com/catapult-project/catapult/web_page_replay_go/')
const WPR_GO_SCRIPT_PATH = path.join(WPR_GO_PATH, 'src/wpr.go')
const ARCHIVE_PATH = path.join(process.cwd(), 'archive.wprgo')

function startRecording() {
  return childProcess.spawn(
    '/usr/local/bin/go',
    ['run', WPR_GO_SCRIPT_PATH, 'record', '--http_port=8080', '--https_port=8081', ARCHIVE_PATH],
    {stdio: 'inherit', cwd: WPR_GO_PATH},
  )
}

function stopRecording(proc) {
  psTree(proc.pid, (err, children) => {
    children.forEach(child => process.kill(child.PID, 'SIGINT'))
  })
}

async function go() {
  console.log('Starting WPR...')
  const wprProcess = startRecording()
  await new Promise(r => setTimeout(r, 10000))
  console.log('Launching Chrome...')
  const browser = await puppeteer.launch({
    args: [
      '--host-resolver-rules="MAP *:80 127.0.0.1:8080,MAP *:443 127.0.0.1:8081,EXCLUDE localhost"',
      '--ignore-certificate-errors-spki-list=PhrPvGIaAMmd29hj8BCZOq096yj7uMpRNHpn5PDxI6I=',
    ],
  })

  const page = await browser.newPage()

  for (const url of officialConfig.collection.urls) {
    try {
      console.log('Recording', url, '...')
      await page.goto(url, {waitUntil: ['load', 'networkidle2']})
      await new Promise(r => setTimeout(r, 10000))
    } catch (err) {
      console.error('Error loading', url)
      console.error(err.stack)
    }
  }

  console.log('Closing Chrome...')
  await browser.close()
  console.log('Closing WPR...')
  stopRecording(wprProcess)
}

go().catch(err => {
  console.error(err)
  process.exit(1)
})
