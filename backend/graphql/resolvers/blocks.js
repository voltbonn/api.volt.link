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

  return new Promise(resolve => {

    const query = {
      // deleted: false,
      ...getPermissionsQuery(context),
    }

    if (args._ids && Array.isArray(args._ids) && args._ids.length > 0) {
      query._id = { $in: args._ids }
    }

    if (args.types && Array.isArray(args.types) && args.types.length > 0) {
      const types = args.types.filter(type => typeof type === 'string')
      query.type = { $in: types }
    }

    if (args.archived && typeof args.archived === 'boolean') {
      if (args.archived === true) {
        query['properties.archived'] = { $eq: true }
      } else {
        console.log('args.archived === false')
        query['properties.archived'] = { $or: [
          { $exists: false },
          { $ne: true },
        ] }
      }
    }

    const cursor = mongodb.collections.blocks.find(query)

    // const cursor = mongodb.collections.blocks.aggregate([
    //   {$match: query}
    // ])

    resolve(cursor.toArray())
  })
}
