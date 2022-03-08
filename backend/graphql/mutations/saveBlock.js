const { getPermissionsAggregationQuery } = require('../functions.js')
const { copyToHistory } = require('../history.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb
	const user = context.user

	if (!context.logged_in) {
		throw new Error('Not logged in.')
	} else {

		const block = args.block || {}

		// _id
		if (!block._id && !mongodb.ObjectId.isValid(block._id)) {
			block._id = new mongodb.ObjectId()
		}

		// properties
		block.properties = block.properties || {}

		// content
		block.content = (block.content || [])
		.filter(content_config => typeof content_config === 'object' && content_config !== null)
		.map(content_config => {
			if (
				content_config.hasOwnProperty('blockId')
				&& mongodb.ObjectId.isValid(content_config.blockId)
			) {
				return {
					blockId: mongodb.ObjectId(content_config.blockId)
				}
			} else if (
				content_config.hasOwnProperty('block')
				&& content_config.block.hasOwnProperty('_id')
				&& mongodb.ObjectId.isValid(content_config.block._id)
			) {
				return {
					blockId: mongodb.ObjectId(content_config.block._id)
				}
			} else {
				return null
			}
		})
		.filter(content_config => content_config !== null)

		// permissions
		if (
			!(!!block.permissions)
			|| Object.keys(block.permissions).length === 0
		) {
			block.permissions = {
					'/': [{
						email: context.user.email,
						role: 'owner',
					}]
			}
		}

	  // check if the block exists
		const resultDoc = await mongodb.collections.blocks
			.findOne({
	  		_id: block._id,
	  	})
	  
	  if (!!resultDoc) {
			const stages = [
					{ $match: { _id: block._id }},
					...getPermissionsAggregationQuery(context, ['editor', 'owner']),
				]

			// if it exists: check if the user has permission and update it
			const matchedBlocks = await mongodb.collections.blocks
				.aggregate(stages)
				.toArray()

			if (matchedBlocks.length > 0) {
				if (!block.metadata) {
					block.metadata = {
						modified_by: user.email,
						modified: new Date(),
					}
				}
				if (block.metadata && block.metadata.__typename) {
					delete block.metadata.__typename
				}

				const result = await mongodb.collections.blocks
					.updateOne({
						_id: block._id,
					}, { $set: {
						...block,
						metadata: {
							...block.metadata,
							modified_by: user.email,
							modified: new Date(),
						}
					}})

				if (result.matchedCount > 0) {
					await copyToHistory(block._id, mongodb)
					return block._id
				} else {
					throw new Error('Could not save the block.')
				}
				
			} else {
				console.error('User does not have permission to update the block.')
				throw new Error('You do not have permission to edit this block.')
			}
	  
		}else{
			// if it does not exist: create it
			const result = await mongodb.collections.blocks
				.insertOne({
					...block,
					metadata: {
						modified_by: user.email,
						modified: new Date(),
					}
				})
				
			if (result.insertedId) {
				await copyToHistory(result.insertedId, mongodb)
				return result.insertedId
			} else {
				console.error('Could not save the block.')
				throw new Error('Could not save the block.')
			}
	  }
	}
}
