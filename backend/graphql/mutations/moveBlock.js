const { getPermissionsAggregationQuery } = require('../functions.js')

async function changeParent(context, newParentId, movingBlockId, newPositionInContent = 0) {
	const mongodb = context.mongodb

	if (!!newParentId) {
		const results = await mongodb.collections.blocks
			.aggregate([
				{$match: {_id: newParentId}},
				...getPermissionsAggregationQuery(context, ['editor', 'owner']),
			])
			.toArray()
			
		if (results.length === 0) {
			throw new Error('no permissions to edit parent')
		} else {

			// 1. save parent info to the block
			await mongodb.collections.blocks
				.aggregate([
					{$match: { _id: movingBlockId }},
					...getPermissionsAggregationQuery(context, ['editor', 'owner']),

	    		{$set: {
						parent: newParentId,
					}},

	    		{ $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
				])
	      .toArray()
					
  		// 2. remove blockId from old parent
  		await mongodb.collections.blocks
				.aggregate([
	  			{$match: {'content.blockId': movingBlockId}},
	  			...getPermissionsAggregationQuery(context, ['editor', 'owner']),

	      	{$redact: {
	      	    $cond: {
	      	      if: { $eq: [ "$blockId", movingBlockId ] },
	      	      then: "$$PRUNE",
	      	      else: "$$DESCEND"
	      	    }
	      	}},

	      	{ $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
	  		])
	      .toArray()
						
    	// 3. add blockId to content of parent
    	await mongodb.collections.blocks
				.aggregate([
	      	{$match: { _id: newParentId }},
	    		...getPermissionsAggregationQuery(context, ['editor', 'owner']),

	        { $set: { content: { $concatArrays: [ '$content', [{
	            blockId: movingBlockId
	        }] ] } } },

	      	{ $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
	    	])
	      .toArray()

		}
	}else{
		throw new Error('newParentId is probably not a mongoId')
	}
}

module.exports = async (parent, args, context, info) => {
	if (!context.logged_in) {
		throw new Error('Not logged in.')
	} else {
		const movingBlockId = args.movingBlockId
		const newParentId = args.newParentId
		const newPositionInContent = args.newIndex

    await changeParent(context, newParentId, movingBlockId, newPositionInContent)
      
		return true
	}
}
