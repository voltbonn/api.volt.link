const { getPermissionsQuery } = require('../functions.js')

const { buildQuery } = require('../buildQuery.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise(async (resolve,reject)=>{

		const query = [
			{ $match: {
        ...getPermissionsQuery(context),
				_id: args._id,
      } },

			...buildQuery(parent, args, context, info),
		]

    const cursor = mongodb.collections.blocks.aggregate(query)
    const blocks = await cursor.toArray()

		if (blocks.length === 0) {
			reject(new Error('Could not find the requested block or no sufficent permission.'))
		} else {
			resolve(blocks[0])
		}
	})
}
