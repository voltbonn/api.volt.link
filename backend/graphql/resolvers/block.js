const { getPermissionsQuery, getRolesOfUser } = require('../functions.js')

const { buildQuery } = require('../buildQuery.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	const query = [
		{ $match: {
			_id: args._id,
      ...getPermissionsQuery(context, null),
    } },

		...buildQuery(parent, args, context, info),
	]

  const cursor = mongodb.collections.blocks.aggregate(query)
  const blocks = await cursor.toArray()

	if (blocks.length === 0) {
		throw new Error('Could not find the requested block or no sufficent permission.')
	} else {
		const block2return = blocks[0]
		
		// Remove permission infos from the block if not logged-in, to not leak user data.
		if (context.logged_in === true) {
			block2return.roles = getRolesOfUser(context, block2return.permissions)
		} else {
			block2return.roles = ['viewer'] // getRolesOfUser doesn't make sense here, as we don't have a user.
			delete block2return.permissions
		}

		return block2return
	}
}
