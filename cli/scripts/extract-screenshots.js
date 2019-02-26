#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const DOWNLOADS_PATH = path.join(__dirname, '../downloads')
const RESULT_PATH = path.join(DOWNLOADS_PATH, 'result.txt')

const contents = fs.readFileSync(RESULT_PATH, 'utf8')
const lines = contents.split('\n')
lines.forEach((line, idx) => {
  if (!line.startsWith('{')) return
  const json = JSON.parse(line.replace(/\\\\"/g, '\\"'))
  const screenshot = json.audits['final-screenshot'].details.data
  const base64 = screenshot.replace('data:image/jpeg;base64,', '')
  console.log(
    `Extracted screenshot ${idx} with TTI of ${json.audits.metrics.details.items[0].interactive}`,
  )
  fs.writeFileSync(
    path.join(DOWNLOADS_PATH, `screenshot-${idx}.jpg`),
    Buffer.from(base64, 'base64'),
  )
  fs.writeFileSync(
    path.join(DOWNLOADS_PATH, `diagnostics-${idx}.txt`),
    JSON.stringify(json.audits.diagnostics.details.items[0], null, 2),
  )
})
