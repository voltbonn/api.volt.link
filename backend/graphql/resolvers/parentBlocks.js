const { getPermissionsQuery } = require('../functions.js')

module.exports = async (parent, args, context, info) => {
  const mongodb = context.mongodb

  return new Promise(async resolve => {
    const cursor = mongodb.collections.blocks.aggregate([
      { $match: {
        _id: args._id,
        ...getPermissionsQuery(context),
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
      { $match: getPermissionsQuery(context) },
    ])

    let blocks = await cursor.toArray()

    // Remove permission infos from the blocks if not logged-in, to not leak user data.
    if (context.logged_in !== true) {
      blocks = blocks.map(block => {
        delete block.permissions
        return block
      })
    }

    resolve(blocks)
  })
}
