async function normalizeUrl(url) {
  if (typeof url !== 'string') {
    return url
  }

  const normalizeUrlModule = await import('normalize-url') // dynamic import cause normalize-url is an es-module.
  const normalizeUrl_ = normalizeUrlModule.default

  return normalizeUrl_(url, {
    // Default options:
    // defaultProtocol: 'http:',
    // normalizeProtocol: true,
    // forceHttp: false,
    // forceHttps: false,
    // stripAuthentication: true,
    // stripHash: false,
    // stripTextFragment: true,
    // stripWWW: true,
    // removeQueryParameters: [/^utm_\w+/i],
    // removeTrailingSlash: true,
    // removeSingleSlash: true,
    // removeDirectoryIndex: false,
    // sortQueryParameters: true,

    // Overwrites:
    defaultProtocol: 'https:',
    stripHash: true,
    stripWWW: false,
  })
}

async function add2queue(mongodb, url = null) {
  if (!url) {
    return false
  }

  const { collections: { url_queue } } = mongodb

  const normalized_url = await normalizeUrl(url)

  const urlDoc = await url_queue
    .findOne({
      url: normalized_url,
    })

  if (urlDoc !== null) {
    return false
  } else {
    url_queue.insertOne({
      url: normalized_url,
      // blockId: new mongodb.ObjectId(), // this blockId should be used when creating or updating the block in the block-collection.
      added_at: new Date(),
    })
  }

  return true
}

module.exports = async (parent, args, context, info) => {
  const mongodb = context.mongodb

  if (!context.logged_in) {
    throw new Error('Not logged in.')
  } else {

    const url = args.url || ''

    if (url.length === 0) {
      throw new Error('Url can\'t be empty.')
    } else {
      if (await add2queue(mongodb, url) === true) {
        return true
      } else {
        throw new Error('Url already in queue.')
      }
    }
  }
}
