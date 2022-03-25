const { getPermissionsQuery, getRolesOfUser } = require('../functions.js')

module.exports = async (parent, args, context, info) => {
	let newContent = (parent.content || [])
	.filter(content => content !== null && Object.keys(content).length > 0) // TODO: This is a BUGFIX! Cause empty content results in an unnecessary empty object.

	if (context.logged_in === true) {
		newContent = newContent.map(contentConfig => {
			if (contentConfig.block && contentConfig.block.permissions) {
				if (!contentConfig.block.computed) {
					contentConfig.block.computed = {}
				}
				contentConfig.block.computed.roles = getRolesOfUser(context, contentConfig.block.permissions)
			}
			return contentConfig
		})
	} else {
		// Remove permission infos from the blocks if not logged-in, to not leak user data.
		newContent = newContent.map(contentConfig => {
			if (contentConfig.block) {
				if (!contentConfig.block.computed) {
					contentConfig.block.computed = {}
				}
				contentConfig.block.computed.roles = ['viewer'] // getRolesOfUser doesn't make sense here, as we don't have a user.
				if (contentConfig.block.permissions) {
					delete contentConfig.block.permissions
				}
			}
			return contentConfig
		})
	}

	const requestedFields = info.fieldNodes[0].selectionSet.selections.map(selection => selection.name.value)

	if (
		requestedFields.includes('block')
		&& typeof newContent === 'object'
		&& Array.isArray(newContent)
		&& newContent.length > 0
	) {
		const blockIds = parent.content
		.filter(contentConfig => !contentConfig.hasOwnProperty('block'))
		.map(contentConfig => contentConfig.blockId)
				
		if (blockIds.length > 0) {
    	const cursor = context.mongodb.collections.blocks.aggregate([
    	  { $match: {
    	    _id: { $in: blockIds },
    	    ...getPermissionsQuery(context),
    	  } },
    	])

    	let blocks = await cursor.toArray()

			if (context.logged_in === true) {
				blocks = blocks.map(block => {
					if (!block.computed) {
						block.computed = {}
					}
					block.computed.roles = getRolesOfUser(context, block.permissions)
					return block
				})
			} else {
				// Remove permission infos from the blocks if not logged-in, to not leak user data.
				blocks = blocks.map(block => {
					if (!block.computed) {
						block.computed = {}
					}
					block.computed.roles = ['viewer'] // getRolesOfUser doesn't make sense here, as we don't have a user.
					delete block.permissions
					return block
				})
			}

    	newContent = newContent.map(contentConfig => {
    	  const block = blocks.find(block => block._id+'' === contentConfig.blockId+'')
    	  return {
    	    ...contentConfig,
    	    block,
    	  }
    	})
		}

   	return newContent
	}

	return []
}
