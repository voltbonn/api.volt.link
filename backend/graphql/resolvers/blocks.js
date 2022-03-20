const { getPermissionsQuery } = require('../functions.js')

const { buildQuery } = require('../buildQuery.js')

module.exports = async (parent, args, context, info) => {
  const mongodb = context.mongodb

  let stages = []

  if (args.roots && Array.isArray(args.roots) && args.roots.length > 0) {
    stages = [
      ...stages,
      { $match: {
        _id: { $in: args.roots },
        ...getPermissionsQuery(context, null),
      }},
      { $graphLookup: {
          from: 'blocks',
          startWith: '$content.blockId',
          connectFromField: 'content.blockId',
          connectToField: '_id',
          as: 'children',
          maxDepth: 100,
          // depthField: 'depth',
          restrictSearchWithMatch: getPermissionsQuery(context, null),
      }},
      { $unwind: '$children' },
      { $replaceRoot: { newRoot: '$children' }}
    ]
  }

  const query = {
    ...getPermissionsQuery(context),
  }

  if (args.ids && Array.isArray(args.ids) && args.ids.length > 0) {
    query._id = { $in: args.ids }
  }

  if (args.types && Array.isArray(args.types) && args.types.length > 0) {
    const types = args.types.filter(type => typeof type === 'string')
    query.type = { $in: types }
  }

  stages.push({ $match: query })



  if (args.hasOwnProperty('archived') && typeof args.archived === 'boolean') {
    if (args.archived === true) {
      stages.push({ $match: {
        'properties.archived': { $eq: true }
      } })
    } else {
      stages.push({ $match: {
        $or: [
          { 'properties.archived': { $exists: false } },
          { $and: [
            { 'properties.archived': { $exists: true } },
            { 'properties.archived': false },
          ]}
        ]
      } })
    }
  }

  stages = [
    ...stages,
    ...buildQuery(parent, args, context, info),
  ]
    
  const cursor = mongodb.collections.blocks.aggregate(stages)

  const blocks = cursor.toArray()

  return blocks
}
