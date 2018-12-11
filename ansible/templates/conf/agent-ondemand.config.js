module.exports = {
  collector: {
    type: 'local',
    repositoryPath: process.env.LH_PATH,
  },
  collection: {
    runs: 5,
    urls: [process.env.LH_URL],
  },
  storage: {
    type: 'sql',
    host: '{{ hostvars[groups["masters"][0]].ansible_default_ipv4.address }}',
  },
  lighthouseConfig: {
    extends: 'lighthouse:default',
    settings: {onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa']},
  },
}
