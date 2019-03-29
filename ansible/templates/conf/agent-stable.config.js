module.exports = {
  collector: {
    type: 'local',
    repositoryPath: process.env.LH_PATH,
  },
  collection: {
    runs: 25,
    urls: ['http://lh-dzl-stable-page.surge.sh/'],
  },
  storage: {
    type: 'sql',
    host: '{{ hostvars[groups["masters"][0]].ansible_default_ipv4.address }}',
  },
  lighthouseConfig: {
    extends: 'lighthouse:default',
    settings: {
      maxWaitForFcp: 30000,
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
    },
  },
}
