module.exports = {
  collector: {
    type: 'psi',
    apiKey: process.env.PSI_TOKEN,
    repositoryPath: process.env.LH_PATH,
  },
  collection: {
    runs: 25,
    urls: [
      'https://example.com',
      'https://m.facebook.com',
      'https://www.amazon.com',
      'https://www.att.com',
      'https://www.cnet.com',
      'https://www.cnn.com',
      'https://www.hulu.com',
      'https://www.linkedin.com',
      'https://www.sfgate.com',
      'https://www.theverge.com',
      'https://www.vevo.com',
      'https://www.wikipedia.org',
    ],
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
