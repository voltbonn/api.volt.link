const { getPermissionsAggregationQuery, getRolesOfUser } = require('../../functions.js')

const { buildQuery } = require('../buildQuery.js')

module.exports = async (parent, args, context, info) => {
  const mongodb = context.mongodb

  const query_text = args.query.trim()

  let stages = []



  // query stage
  let query_and = []

  query_and.push({
    $or: [
      { 'properties.text': { $regex: query_text, $options: 'i' } },
      { 'properties.translations.text': { $regex: query_text, $options: 'i' } },
      { 'properties.slug': { $regex: query_text, $options: 'i' } },
      { 'properties.url': { $regex: query_text, $options: 'i' } },
      { 'properties.description': { $regex: query_text, $options: 'i' } },
      // { 'properties.linked_websites.text': { $regex: query_text, $options: 'i' } },
      // { 'properties.linked_images.text': { $regex: query_text, $options: 'i' } },
    ]
  })

  if (args.types && Array.isArray(args.types) && args.types.length > 0) {
    const types = args.types.filter(type => typeof type === 'string')
    query_and.push({ type: { $in: types } })
  }

  if (args.hasOwnProperty('archived') && typeof args.archived === 'boolean') {
    if (args.archived === true) {
      query_and.push({
        'properties.archived': { $eq: true }
      })
    } else {
      query_and.push({
        $or: [
          { 'properties.archived': { $exists: false } },
          {
            $and: [
              { 'properties.archived': { $exists: true } },
              { 'properties.archived': false },
            ]
          }
        ]
      })
    }
  }

  const query = { $and: query_and }
  stages.push({ $match: query })




  // combine query stage with permissions and sub-queries
  stages = [
    ...stages,
    ...getPermissionsAggregationQuery(context),
    ...buildQuery(parent, args, context, info),
    { $sort: { 'metadata.modified': -1 } },
    { $limit: 50 },
  ]

  const cursor = mongodb.collections.blocks.aggregate(stages)

  let blocks = await cursor.toArray()

  if (context.logged_in === true) {
    blocks = blocks.map(block => {
      if (!block.computed) {
        block.computed = {}
      }
      block.computed.roles = getRolesOfUser(context, block)
      return block
    })
  } else {
    // Remove permission infos from the blocks if not logged-in, to not leak user data.
    blocks = blocks.map(block => {
      if (!block.properties) {
        block.properties = {}
      }
      if (!block.computed) {
        block.computed = {}
      }
      block.computed.roles = ['viewer'] // getRolesOfUser doesn't make sense here, as we don't have a user.
      delete block.permissions
      delete block.computed.inherited_block_permissions
      return block
    })
  }

  return blocks
}
