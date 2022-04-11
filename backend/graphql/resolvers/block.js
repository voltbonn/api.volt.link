const { getPermissionsAggregationQuery, getRolesOfUser } = require('../../functions.js')

const { buildQuery } = require('../buildQuery.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	const query = [
		{
			$match: {
				_id: args._id,
			}
		},
		...getPermissionsAggregationQuery(context),

		...buildQuery(parent, args, context, info),
	]

  const cursor = mongodb.collections.blocks.aggregate(query)
  const blocks = await cursor.toArray()

	if (blocks.length === 0) {
		throw new Error('Could not find the requested block or no sufficent permission.')
	} else {
		const block2return = blocks[0]

		if (!block2return.computed) {
			block2return.computed = {}
		}

		if (context.logged_in === true) {
			block2return.computed.roles = getRolesOfUser(context, block2return)
		} else {
			block2return.computed.roles = ['viewer'] // getRolesOfUser doesn't make sense here, as we don't have a user.
			delete block2return.permissions // Remove permission infos from the block if not logged-in, to not leak user data.
			delete block2return.computed.inherited_block_permissions
		}

		return block2return
	}
}
