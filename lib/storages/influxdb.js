const path = require('path')

module.exports = {
  defaults: {
    database: 'dxl-lighthouse',
  },
  async run({url, hash, lhr, storageOptions}) {
    console.log(url, hash, 'done!')
  },
}
