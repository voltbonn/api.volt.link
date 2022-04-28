const { getPermissionsAggregationQuery, flattenObject } = require('../../functions.js') // changeParent
const { copyToHistory } = require('../history.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb
	const user = context.user

	if (!context.logged_in) {
		throw new Error('Not logged in.')
	} else {

		const block = args.block || {}

		let blockId = block._id

		if (block.hasOwnProperty('computed')) {
			delete block.computed // This should be able to be send to the server, but it should not be saved to the DB.
		}

		if (block.hasOwnProperty('content') && Array.isArray(block.content)) {
			block.content = block.content
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
		}

		// check if the block exists
		let blockExistsDoc = null
		if (blockId) {
			blockExistsDoc = await mongodb.collections.blocks
			.findOne({
				_id: blockId,
			})
		} else {
			blockId = new mongodb.ObjectId()
		}
		
		let shouldCopyToHistory = false

		if (!!blockExistsDoc) {
			// block already exists

			// check if the user has edit permissions
			const editPermissionsDocs = await mongodb.collections.blocks
				.aggregate([
					{ $match: { _id: blockId } },
					...getPermissionsAggregationQuery(context, ['editor', 'owner']),
				])
				.toArray()
			
			if (editPermissionsDocs.length > 0) {
				// update changed properties

				const updatePipline = []

				const unset = []
				const set = {
					'metadata.modified_by': user.email,
					'metadata.modified': new Date(),
				}

				const flattenedBlock = flattenObject(block)

				for (const key in flattenedBlock) {
					const value = flattenedBlock[key]
					if (value === null) {
						unset.push(key)
					} else {
						set[key] = value
					}
				}

				if (Object.keys(unset).length > 0) {
					updatePipline.push({ $unset: unset })
				}
				if (Object.keys(set).length > 0) {
					updatePipline.push({ $set: set })
				}

				const updateResult = await mongodb.collections.blocks
					.updateOne(
						{ _id: blockId },
						updatePipline,
						{
							upsert: false,
						}
					)
					
				if (updateResult.modifiedCount > 0) {
					// block updated
					shouldCopyToHistory = true
				} else if (updateResult.matchedCount > 0) {
					// block was not updated
					// but everything is fine
				} else { // updateResult.matchedCount === 0
					// block was not updated
					// because it could not be found
					throw new Error('Could not find the block.')
				}
			} else {
				throw new Error('No permissions to edit block.')
			}
		} else {
			// The block does not exist: Create it!

			// metadata
			block.metadata = {
				...(block.metadata || {}),
				modified_by: user.email,
				modified: new Date(),
			}

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

			const result = await mongodb.collections.blocks
				.insertOne(block)

			blockId = result.insertedId

			shouldCopyToHistory = true
		}

		if (blockId) {
			if (shouldCopyToHistory) {
				// copy to history
				await copyToHistory(blockId, mongodb)
			}

			return blockId
		} else {
			throw new Error('Could not save the block.')
		}
	}
}
