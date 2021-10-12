module.exports = (parent, args, context, info) => {
	const mongodb = context.mongodb

	console.log('args', args)

	return new Promise((resolve,reject)=>{
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
		block.permissions = (block.permissions || [])

		// parent
		if (mongodb.ObjectId.isValid(block.parent)) {
			block.parent = new mongodb.ObjectId(block.parent)
		}

		// save the block
		mongodb.collections.blocks.updateOne(
			{ _id: block._id },
			{ $set: block },
			{ upsert: true }
		)
		.then(result => {
			if (result.upsertedCount > 0 && result.upsertedId) {
				resolve(result.upsertedId)
			} else if (result.acknowledged === true && (result.modifiedCount > 0 || result.matchedCount > 0)) {
				resolve(block._id)
			} else {
				reject('Could not save the block.')
			}
		})
		.catch(error => reject(error))
	})
}
