const { getPermissionsAggregationQuery, getRolesOfUser } = require('../../functions.js')

const { buildQuery } = require('../buildQuery.js')

async function lastModifiedBlocks(parent, args, context, info) {
  if (!context.logged_in) {
    return []
  }

  const user_email = ((context || {}).user || {}).email || ''
  if (typeof user_email !== 'string' || user_email.length === 0) {
    return []
  }

  const mongodb = context.mongodb

  let types = ['page']
  if (Array.isArray(args.types) && args.types.length > 0) {
    types = args.types
      .filter(Boolean)
      .filter(t => typeof t === 'string' && t.length > 0)
      .map(type => type.toLowerCase())
  }

  let stages = [
    {
      $match: {
        type: { $in: types },
        'metadata.modified_by': user_email
      }
    },
  ]

  let roles = null
  if (args.hasOwnProperty('roles') && Array.isArray(args.roles) && args.roles.length > 0) {
    roles = args.roles
      .filter(role => typeof role === 'string')
      .map(role => role.toLowerCase())
  }

  stages = [
    ...stages,
    {
      $group: {
        _id: '$isHistoryFor',
        block: { $first: '$$ROOT' }
      }
    },
    {
      $lookup: {
        from: 'blocks',
        localField: 'block.isHistoryFor',
        foreignField: '_id',
        as: 'real_current_block'
      }
    },
    {
      $replaceRoot: {
        newRoot: { $first: '$real_current_block' }
      }
    },
    {
      $match: {
        type: { $in: types },
      }
    },
    ...getPermissionsAggregationQuery(context, roles),

    {
      $sort: {
        'metadata.modified': -1,
        'isHistoryFor': -1,
        '_id': -1
      }
    },
  ]

  if (args.hasOwnProperty('archived') && typeof args.archived === 'boolean') {
    if (args.archived === true) {
      stages.push({
        $match: {
          'properties.archived': { $eq: true }
        }
      })
    } else {
      stages.push({
        $match: {
          $or: [
            { 'properties.archived': { $exists: false } },
            {
              $and: [
                { 'properties.archived': { $exists: true } },
                { 'properties.archived': false },
              ]
            }
          ]
        }
      })
    }
  }

  if (!args.hasOwnProperty('first') || typeof args.first !== 'number' || args.first.limit < 1) {
    args.first = 10
  }
  stages.push({ $limit: args.first })

  stages = [
    ...stages,
    ...buildQuery(parent, args, context, info),
  ]

  const cursor = mongodb.collections.history.aggregate(stages, { allowDiskUse: true })

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

module.exports = lastModifiedBlocks
