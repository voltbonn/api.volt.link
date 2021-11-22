const { getPermissionsQuery } = require('../functions.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
			if (args._id && mongodb.ObjectID.isValid(args._id)) {
    		const cursor = mongodb.collections.blocks.aggregate([
					{ $match: {
						_id: mongodb.ObjectID(args._id),
						...getPermissionsQuery(context),
					} },
					{ $graphLookup: {
						from: 'blocks',
						startWith: '$parent',
						connectFromField: 'parent',
						connectToField: '_id',
						as: 'parentBlocks',
						maxDepth: 50,
						depthField: "computed.sort",
						// restrictSearchWithMatch: <document>
					}},
					{ $unwind : "$parentBlocks" },
					{ $replaceRoot: { newRoot: "$parentBlocks" } },
					{ $match: getPermissionsQuery(context) },
    		])

      	resolve(cursor.toArray())
			} else {
				reject('missing _id variable in graphql query or _id is not a correct mongoDB')
			}
	})
}
