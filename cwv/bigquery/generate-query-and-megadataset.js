const fs = require('fs')
const path = require('path')
const thirdPartyWeb = require('third-party-web')

const SQL_IN = fs.readFileSync(path.join(__dirname, 'pages-for-entity.sql'), 'utf8')

const entities = [
  'doubleclick.net',
  'youtube.com',
  'facebook.com',
  'mc.yandex.ru',
  'fonts.gstatic.com',
  'maps.google.com',
  'google-analytics.com',
  'zendesk.com',
  'addthis.com',
  'abs.twimg.com',
]

const MEGADATASET = []
const WHERE_CLAUSES = []
for (const entity_ of entities) {
  const entity = thirdPartyWeb.getEntity(entity_)
  if (!entity) throw new Error(`No entity for ${entity_}`)
  const domains = Array.from(
    new Set(
      entity.domains.map((domain) =>
        domain.replace(/\*/g, '').replace(/adservice.google..*/, 'adservice.google.'),
      ),
    ),
  ).map((domain) => (domain.endsWith('.') ? domain : `${domain}/`))

  WHERE_CLAUSES.push(
    [
      `${entity.name}`,
      `AND (`,
      ...domains.map((domain, index) => `  ${index === 0 ? '' : 'OR '}url LIKE '%${domain}%'`),
      `)`,
    ]
      .map((l) => `  -- ${l}`)
      .join('\n'),
  )

  const safeName = entity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const expectedFilePath = path.join(__dirname, 'datasets', `${safeName}-urls.json`)
  if (fs.existsSync(expectedFilePath)) {
    console.warn(`Dataset found for ${entity.name}`)
    const dataset = JSON.parse(fs.readFileSync(expectedFilePath, 'utf8'))
    MEGADATASET.push({patterns: domains, urls: dataset.map((item) => item.pageUrl)})
  } else {
    console.warn(`Dataset NOT found for ${entity.name}`)
  }
}

const MEGASET_OUT = JSON.stringify(MEGADATASET, null, 2)
const SQL_OUT = SQL_IN.replace('--INSERT ENTITY QUERY HERE--', WHERE_CLAUSES.join('\n'))
fs.writeFileSync(path.join(__dirname, 'pages-for-entity.gen.sql'), SQL_OUT)
fs.writeFileSync(path.join(__dirname, 'datasets', 'megadataset.gen.json'), MEGASET_OUT)
