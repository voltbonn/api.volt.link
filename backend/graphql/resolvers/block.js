const { getPermissionsAggregationQuery, cleanUpBlock } = require('../../functions.js')

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
		const block2return = cleanUpBlock(context, blocks[0])
		if (!block2return.properties) {
			block2return.properties = {}
		}
		return block2return
	}
}
