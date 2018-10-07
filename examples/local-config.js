module.exports = {
  collector: {
    type: 'local',
    // repositoryPath: 'path/to/lighthouse',
  },
  collection: {
    runs: 9,
    urls: [
      'https://example.com',
      'https://www.cnn.com',
      'https://www.theverge.com',
      'https://www.sfgate.com/',
    ],
  },
  storage: {
    type: 'influxdb',
    database: 'dzl-lighthouse',
  },
  lighthouseConfig: {
    extends: 'lighthouse:default',
    settings: {onlyCategories: ['performance']},
  },
}
