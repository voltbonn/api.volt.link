const { getPermissionsAggregationQuery } = require('../../functions.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	const cursor = mongodb.collections.blocks.aggregate([
		{ $match: {
			_id: args._id,
		} },

		...getPermissionsAggregationQuery(context, args.roles),
	])

	let blocks = await cursor.toArray()

	if (blocks.length > 0) {
		return true
	}
	
	return false
}
