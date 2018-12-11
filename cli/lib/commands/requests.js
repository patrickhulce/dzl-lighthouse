const _ = require('lodash')
const storage = require(`../storages/sql`)

async function getNextRequest({Request}) {
  const request = await Request.findOne({
    where: {status: 'pending'},
    order: [['createdAt', 'desc']],
  })

  if (request) {
    console.log(
      [
        'export HAS_NEXT=1',
        `export REQUEST_ID="${request.id}"`,
        `export LH_URL="${request.url}"`,
        `export LH_HASH_A="${request.hashA}"`,
        `export LH_HASH_B="${request.hashB}"`,
      ].join('\n'),
    )
  } else {
    console.log('export HAS_NEXT=0')
  }
}

async function updateRequest({Request, status, requestId}) {
  const request = await Request.findById(requestId)
  if (!request) throw new Error(`Could not find request with ID ${requestId}`)
  request.status = status
  await request.save()
}

module.exports = async function requests(args) {
  const {action, status, requestId, config} = args
  const storageOptions = _.merge(_.cloneDeep(storage.defaults), config.storage)
  const {Request} = await storage.build(storageOptions)

  if (action === 'get') {
    return getNextRequest({Request})
  } else if (action === 'update') {
    return updateRequest({Request, status, requestId})
  } else {
    throw new Error(`Unrecognized action ${action}`)
  }
}
