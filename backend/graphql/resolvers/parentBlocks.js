const { getPermissionsAggregationQuery, getRolesOfUser } = require('../../functions.js')

module.exports = async (parent, args, context, info) => {
  const mongodb = context.mongodb

  return new Promise(async resolve => {
    const cursor = mongodb.collections.blocks.aggregate([
      { $match: {
        _id: args._id,
      } },

      { $graphLookup: {
        from: 'blocks',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'content.blockId',
        as: 'parents',
        maxDepth: 50,
        depthField: 'computed.sort',
        // restrictSearchWithMatch: <document>
      }},

      { $unwind : '$parents' },
      { $replaceRoot: { newRoot: '$parents' } },

      ...getPermissionsAggregationQuery(context),
    ])

    let blocks = await cursor.toArray()

    if (context.logged_in === true) {
      blocks = blocks.map(block => {
        if (!block.computed) {
          block.computed = {}
        }
        block.computed.roles = getRolesOfUser(context, block.permissions)
        return block
      })
    } else {
      // Remove permission infos from the blocks if not logged-in, to not leak user data.
      blocks = blocks.map(block => {
        if (!block.computed) {
          block.computed = {}
        }
        block.computed.roles = ['viewer'] // getRolesOfUser doesn't make sense here, as we don't have a user.
        delete block.permissions
        return block
      })
    }

    resolve(blocks)
  })
}
