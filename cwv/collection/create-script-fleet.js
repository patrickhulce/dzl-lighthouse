const fs = require('fs-extra')
const path = require('path')
const rimraf = require('rimraf')

const TMP_DIR = path.join(__dirname, '.tmp')
rimraf.sync(TMP_DIR)
fs.mkdirSync(TMP_DIR)

const MEGADATASET = require('../bigquery/datasets/megadataset.gen.json')
MEGADATASET.forEach((entity, i) => {
  const dir = path.join(TMP_DIR, `instance${i}`)
  fs.mkdirSync(dir)
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.sh'))
  files.forEach((f) => fs.copySync(path.join(__dirname, f), path.join(dir, f)))
  fs.writeFileSync(
    path.join(dir, 'blocked-patterns.txt'),
    entity.patterns.map((p) => `--blocked-url-patterns="${p}"`).join(' '),
  )
  fs.writeFileSync(path.join(dir, 'urls.txt'), entity.urls.slice(0, 10).join('\n'))
})
