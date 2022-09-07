const { getPermissionsAggregationQuery, getRolesOfUser } = require('../../functions.js')

const { buildQuery } = require('../buildQuery.js')

async function pagedBlocks(parent, args, context, info) {
  const mongodb = context.mongodb

  let stages = []

  if (args.roots && Array.isArray(args.roots) && args.roots.length > 0) {
    stages = [
      ...stages,
      {
        $match: {
          _id: { $in: args.roots },
        }
      },
      ...getPermissionsAggregationQuery(context),
      {
        $addFields: {
          root: '$$ROOT',
        }
      },
      {
        $graphLookup: {
          from: 'blocks',
          startWith: '$content.blockId',
          connectFromField: 'content.blockId',
          connectToField: '_id',
          as: 'children',
          maxDepth: 100,
          // depthField: 'depth',
        }
      },
      {
        $addFields: {
          children: {
            $concatArrays: [
              ['$root'],
              '$children'
            ]
          },
        }
      },
      { $unwind: '$children' },
      { $replaceRoot: { newRoot: '$children' } }
    ]
  }



  let query = {}

  if (args.types && Array.isArray(args.types) && args.types.length > 0) {
    const types = args.types.filter(type => typeof type === 'string')
    if (types.length > 0) {
      query.type = { $in: types }
    }
  }


  let ids = []
  if (Array.isArray(args.ids) && args.ids.length > 0) {
    // Convert ids to mongodb ids. I can't rely on GraphQL to do this for me, as I'm sending non mongodb ids to it.
    ids = args.ids
      .filter(id => id && mongodb.ObjectId.isValid(id))
      .map(id => new mongodb.ObjectId(id))
  }

  let slugs = []
  if (Array.isArray(args.slugs) && args.slugs.length > 0) {
    slugs = args.slugs
      .filter(slug => slug && typeof slug === 'string')
  }

  if (
    Array.isArray(ids) && ids.length > 0
    && Array.isArray(slugs) && slugs.length > 0
  ) {
    if (Object.keys(query).length > 0) {
      query = {
        $and: [
          {
            $or: [
              { _id: { $in: ids } },
              { 'properties.slug': { $in: slugs } },
            ],
          },
          query,
        ]
      }
    } else {
      query = {
        $or: [
          { _id: { $in: ids } },
          { 'properties.slug': { $in: slugs } },
        ],
      }
    }
  } else if (Array.isArray(ids) && ids.length > 0) {
    query = {
      ...query,
      _id: { $in: ids }
    }
  } else if (Array.isArray(slugs) && slugs.length > 0) {
    query = {
      ...query,
      'properties.slug': { $in: slugs }
    }
  }

  stages.push({ $match: query })



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

  let roles = null
  if (args.hasOwnProperty('roles') && Array.isArray(args.roles) && args.roles.length > 0) {
    roles = args.roles
  }

  stages = [
    ...stages,
    ...getPermissionsAggregationQuery(context, roles),
    ...buildQuery(parent, args, context, info),
    {
      $sort: {
        'metadata.modified': 1,
        '_id': 1,
      }
    }
  ]

  // START Cursor Pagination
  // EdgesToReturn(allEdges, before, after, first, last)

  // let before = null
  // if (args.before && typeof args.before === 'string') {
  //   if (mongodb.ObjectId.isValid(args.before)) {
  //     before = new mongodb.ObjectId(args.before)
  //   }
  // }
  // let after = null
  // if (args.after && typeof args.after === 'string') {
  //   if (mongodb.ObjectId.isValid(args.after)) {
  //     after = new mongodb.ObjectId(args.after)
  //   }
  // }
  // TODO limit by before and after

  let first = 1
  if (args.first && typeof args.first === 'number' && args.first > 0) {
    first = args.first
    stages.push({ $limit: first })
  }
  // let last = 1
  // if (args.last && typeof args.last === 'number' && args.last > 0) {
  //   last = args.last
  //   // stages.push({ $limit: first }) // TODO somehow get the last x items
  // }
  // END Cursor Pagination

  const cursor = mongodb.collections.blocks.aggregate(stages, { allowDiskUse: true })

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

  return {
    // Specification: https://relay.dev/graphql/connections.htm
    pageInfo: {
      hasNextPage: true, // TODO: Implement this
      hasPreviousPage: true, // TODO: Implement this
      startCursor: blocks.length > 0 ? blocks[0]._id : null,
      endCursor: blocks.length > 0 ? blocks[blocks.length - 1]._id : null,
    },
    blocks,
  }
}

async function blocks(parent, args, context, info) {
  args.first = 1000
  const paged_blocks = await pagedBlocks(parent, args, context, info)
  return paged_blocks.blocks
}

module.exports = {
  pagedBlocks,
  blocks,
}
