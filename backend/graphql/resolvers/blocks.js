const { getPermissionsQuery } = require('../functions.js')

module.exports = async (parent, args, context, info) => {
  const mongodb = context.mongodb

  // const hasBlockSubQuery = info
  // .operation
  // .selectionSet
  // .selections
  // .find(s => s.name.value === 'blocksByIds')
  // .selectionSet
  // .selections
  // .find(s => s.name.value === 'content')
  // .selectionSet
  // .selections
  // .find(s => s.name.value === 'block')

  const stages = []

  const query = {
    ...getPermissionsQuery(context),
  }

  if (args._ids && Array.isArray(args._ids) && args._ids.length > 0) {
    query._id = { $in: args._ids }
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

    
  const cursor = mongodb.collections.blocks.aggregate(stages)

  return cursor.toArray()
}
