const { getPermissionsAggregationQuery, getContentAggregationQuery, getRolesOfUser } = require('../../functions.js')

module.exports = async (parent, args, context, info) => {
	let newContent = []
	if (Array.isArray(parent.content) && parent.content.length > 0) {
		newContent = parent.content
	}
	newContent = newContent.filter(content => content !== null && Object.keys(content).length > 0) // TODO: This is a BUGFIX! Cause empty content results in an unnecessary empty object.

	if (context.logged_in === true) {
		newContent = newContent.map(contentConfig => {
			if (contentConfig.block && contentConfig.block.permissions) {
				if (!contentConfig.block.properties) {
					contentConfig.block.properties = {}
				}
				if (!contentConfig.block.computed) {
					contentConfig.block.computed = {}
				}
				contentConfig.block.computed.roles = getRolesOfUser(context, contentConfig.block)
			}
			return contentConfig
		})
	} else {
		// Remove permission infos from the blocks if not logged-in, to not leak user data.
		newContent = newContent.map(contentConfig => {
			if (contentConfig.block) {
				if (!contentConfig.block.properties) {
					contentConfig.block.properties = {}
				}
				if (!contentConfig.block.computed) {
					contentConfig.block.computed = {}
				}
				contentConfig.block.computed.roles = ['viewer'] // getRolesOfUser doesn't make sense here, as we don't have a user.
				delete contentConfig.block.permissions
				delete contentConfig.block.computed.inherited_block_permissions
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
    	  } },

				...getPermissionsAggregationQuery(context),
				// ...getContentAggregationQuery(context),
			], { allowDiskUse: true })

    	let blocks = await cursor.toArray()

			if (context.logged_in === true) {
				blocks = blocks.map(block => {
					if (!block.properties) {
						block.properties = {}
					}
					if (!block.computed) {
						block.computed = {}
					}
					block.computed.roles = getRolesOfUser(context, block)
					return block
				})
			} else {
				// Remove permission infos from the blocks if not logged-in, to not leak user data.
				blocks = blocks.map(block => {
					if (!block.properties) {
						block.properties = {}
					}
					if (!block.computed) {
						block.computed = {}
					}
					block.computed.roles = ['viewer'] // getRolesOfUser doesn't make sense here, as we don't have a user.
					delete block.permissions
					delete block.computed.inherited_block_permissions
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
