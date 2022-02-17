const { getPermissionsQuery } = require('../functions.js')

module.exports = async (parent, args, context, info) => {
	let newContent = parent.content

	if (
		typeof newContent === 'object'
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

    	const blocks = await cursor.toArray()

    	newContent = parent.content.map(contentConfig => {
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
