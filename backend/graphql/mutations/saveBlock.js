const { getPermissionsAggregationQuery } = require('../functions.js')

module.exports = (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
		if (!context.logged_in) {
			reject('Not logged in.')
		} else {

			const block = args.block || {}

			// // _id
			// if (block._id && mongodb.ObjectId.isValid(block._id)) {
			// 	block._id = new mongodb.ObjectId(block._id)
			// } else {
			// 	block._id = new mongodb.ObjectId()
			// }

			// properties
			block.properties = block.properties || {}

			// content
			block.content = (block.content || [])
			.filter(content_config => typeof content_config === 'object' && content_config !== null)
			.filter(content_config => content_config.hasOwnProperty('blockId') && mongodb.ObjectId.isValid(content_config.blockId))

			// permissions
			block.permissions = (block.permissions || [{
				email: context.user.email,
				role: 'owner',
			}])

	    // check if the block exists
			mongodb.collections.blocks.findOne({
	    	_id: block._id,
	    })
	    .then(async resultDoc => {
	    	if (!!resultDoc) {
					// if it exists: check if the user has permission and update it
					await mongodb.collections.blocks.aggregate([
						{ $match: { _id: block._id }},
						...getPermissionsAggregationQuery(context, ['editor', 'owner']),

						{ $set: block},
						{ $set: {
							'metadata.created': { $toDate: '$metadata.created' },
							'metadata.modified': new Date(),
						}},

						{ $merge: { into: 'blocks', on: '_id', whenMatched: 'replace', whenNotMatched: 'discard' } }
					])

					resolve(block._id)
	    	}else{
					// if it does not exist: create it
					mongodb.collections.blocks.insertOne({
						...block,
						metadata: {
							created: new Date(),
							modified: new Date(),
						}
					})
					.then(result => {
						if (result.insertedId) {
							resolve(result.insertedId)
						} else {
							reject('Could not save the block.')
						}
					})
					.catch(reject)
	    	}
	    })
	    .catch(reject)
		}
	})
}
