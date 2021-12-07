const { getPermissionsQuery } = require('../functions.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
			if (args._id && mongodb.ObjectID.isValid(args._id)) {

				const finalQuery = {
					...getPermissionsQuery(context),
				}

				if (Array.isArray(args.types) && args.types.length > 0) {
					finalQuery.type = { $in: args.types }
				}

    		const cursor = mongodb.collections.blocks.aggregate([
					{ $match: {
						_id: new mongodb.ObjectID(args._id),
						...getPermissionsQuery(context),
					} },

					{$lookup: {
			      from: 'blocks',
			      localField: '_id',
			      foreignField: 'content.blockId',
			      as: 'parents',
			    }},

			    {$unwind: '$parents' },
			    {$unwind: '$parents.content' },
			    { $replaceRoot: { newRoot: '$parents.content' } },

			    {$lookup: {
			      from: 'blocks',
			      localField: 'blockId',
			      foreignField: '_id',
			      as: 'siblings',
			    }},

					{ $unwind : '$siblings' },
					{ $replaceRoot: { newRoot: '$siblings' } },
					{ $match: finalQuery },
    		])

      	resolve(cursor.toArray())
			} else {
				reject('missing _id variable in graphql query or _id is not a correct mongoDB')
			}
	})
}
