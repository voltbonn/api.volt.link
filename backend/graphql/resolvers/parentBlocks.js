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

      	resolve(cursor.toArray())
			} else {
				reject('missing _id variable in graphql query or _id is not a correct mongoDB')
			}
	})
}
