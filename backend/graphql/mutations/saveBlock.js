const { getPermissionsQuery } = require('../functions.js')

module.exports = (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
		if (!context.logged_in) {
			reject('Not logged in.')
		} else {

			const block = args.block

			// _id
			if (block._id && mongodb.ObjectId.isValid(block._id)) {
				block._id = new mongodb.ObjectId(block._id)
			} else {
				block._id = new mongodb.ObjectId()
			}

			// properties
			block.properties = block.properties || {}

			// content
			block.content = (block.content || [])
			.filter(content_config => content_config.hasOwnProperty('blockId') && mongodb.ObjectId.isValid(content_config.blockId))
			.map(content_config => ({
				// ...content_config,
				tmp_id: content_config.tmp_id || null,
				blockId: new mongodb.ObjectId(content_config.blockId)
			}))

			// permissions
			block.permissions = (block.permissions || [{
				email: context.user.email,
				role: 'owner',
			}])

			if (!block.hasOwnProperty('metadata')) {
				block.metadata = {}
			}
			if (!block.metadata.hasOwnProperty('created')) {
				block.metadata.created = new Date()
			}
			block.metadata.modified = new Date()

			// parent
			if (mongodb.ObjectId.isValid(block.parent)) {
				block.parent = new mongodb.ObjectId(block.parent)
			}

	    // check if the block exists
			mongodb.collections.blocks.findOne({
	    	_id: block._id,
	    })
	    .then(resultDoc => {
	    	if (!!resultDoc) {
					// if it exists: check if the user has permission and update it
					mongodb.collections.blocks.updateOne(
						{
							_id: block._id,
							...getPermissionsQuery(context, ['editor', 'owner']),
						},
						{ $set: block },
						{ upsert: false }
					)
					.then(result => {
						if (result.upsertedCount > 0 && result.upsertedId) {
							resolve(result.upsertedId)
						} else if (result.acknowledged === true && (result.modifiedCount > 0 || result.matchedCount > 0)) {
							resolve(block._id)
						} else {
							reject('Probably no permissions to save the block.')
						}
					})
					.catch(reject)
	    	}else{
					// if it does not exist: create it
					mongodb.collections.blocks.insertOne(block)
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
