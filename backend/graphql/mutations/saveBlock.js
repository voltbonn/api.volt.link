const { getPermissionsAggregationQuery, flattenObject } = require('../../functions.js') // changeParent
const { copyToHistory } = require('../history.js')

const { loadBlock } = require('../buildQuery.js')

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
		let blockExists = false
		if (blockId) {
			const blockExistsDoc = await mongodb.collections.blocks
			.findOne({
				_id: blockId,
			})

			if (!!blockExistsDoc) {
				blockExists = true
			}
		}
		
		let shouldCopyToHistory = false

		if (blockExists === true) {
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
			
			let blockIsNotEmpty = false

			if (
				block.hasOwnProperty('content')
				&& typeof block.content === 'object'
				&& block.content !== null
				&& block.content !== undefined
				&& Array.isArray(block.content)
				&& block.content.length > 0
			) {
				blockIsNotEmpty = true
			}

			if (
				block.hasOwnProperty('properties')
				&& typeof block.properties === 'object'
				&& block.properties !== null
				&& block.properties !== undefined
				&& Object.keys(block.properties).length > 0
			) {
				let notEmptyProperties = {}

				// only keep the properties that are not empty
				for (const key in block.properties) {
					if (block.properties.hasOwnProperty(key)) {
						const value = block.properties[key]

						if (typeof value === 'string') {
							if (value !== '') {
								notEmptyProperties[key] = value
							}
						} else if (typeof value === 'object') {
							if (value === null || value === undefined) {
								// do nothing
							} else if (Array.isArray(value)) {
								if (value.length > 0) {
									notEmptyProperties[key] = null
								}
							} else if (Object.keys(value).length > 0) {
								notEmptyProperties[key] = null
							}
						}
					}
				}

				block.properties = notEmptyProperties

				if (Object.keys(notEmptyProperties).length > 0) {
					blockIsNotEmpty = true
				}
			}

			if (true || blockIsNotEmpty) { // TODO: can we remove the true?
				block._id = new mongodb.ObjectId()

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
			} else {
				throw new Error('Won\'t save empty block.')
			}
		}

		if (shouldCopyToHistory === true) {
			// block was created or updated (disregarding if it existed before)
			await copyToHistory(blockId, mongodb)
			return await loadBlock(parent, { _id: blockId }, context, info)
		} else if (blockExists === true) {
			// block exists BUT was not updated
			return await loadBlock(parent, { _id: blockId }, context, info)
		} else {
			// block did not exists AND it was not created
			throw new Error('Could not create the block.')

			// // This is like a silent fail.
			// // We only want to set a new blockId for the provided block.
			// // We could but don't want to save it yet, as it's probably empty.
			//
			// block._id = new mongodb.ObjectId()
			// block.permissions = {
			// 	'/': [{
			// 		email: context.user.email,
			// 		role: 'owner',
			// 	}]
			// }
			//
			// return block
		}
	}
}
