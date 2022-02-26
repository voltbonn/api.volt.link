const { getPermissionsQuery } = require('../functions.js')

async function both (parent, args, context, info) {
	const mongodb = context.mongodb

	if (!context.logged_in) {
		throw new Error('Not logged in.')
	} else {
		const set_or_unset_stage = []
		if (args.archive === false) {
			set_or_unset_stage.push({ $unset: 'properties.archived' })
		} else {
			set_or_unset_stage.push({ $set: { 'properties.archived': true } })
		}

		// mark all children and its content blocks as archived
		await mongodb.collections.blocks.aggregate([
	    { $match: {
	      _id: args._id,
	      ...getPermissionsQuery(context, ['editor', 'owner']),
	    } },
    
    	{ $facet: {
    	  fromContent: [
    	    { $graphLookup: {
    	      from: 'blocks',
    	      startWith: '$_id',
    	      connectFromField: 'content.blockId',
    	      connectToField: '_id',
    	      as: 'kids',
    	      maxDepth: 50,
    	      restrictSearchWithMatch: {
    	        ...getPermissionsQuery(context, ['editor', 'owner']),
    	      }
    	    }},
        	{ $unwind: '$kids' },
        	{ $replaceRoot: { newRoot: '$kids' } },
    		],
    	  fromParent: [
    	    { $graphLookup: {
    	      from: 'blocks',
    	      startWith: '$_id',
    	      connectFromField: '_id',
    	      connectToField: 'parent',
    	      as: 'kids',
    	      maxDepth: 50,
    	      restrictSearchWithMatch: {
    	        ...getPermissionsQuery(context, ['editor', 'owner']),
    	      }
    	    }},
    	    { $unwind: '$kids' },
    	    { $replaceRoot: { newRoot: '$kids' } },
    	  ]
    	}},
    
    	{ $project: {
    	  blocks: { $setUnion: [ '$fromContent', '$fromParent' ] }
    	}},
    
    	{ $unwind: '$blocks' },
    	{ $replaceRoot: { newRoot: '$blocks' } },
    
    	// ...getPermissionsAggregationQuery(context, ['editor', 'owner']),
        
    	...set_or_unset_stage,

    	{ $merge: { into: 'blocks', on: '_id', whenMatched: 'replace', whenNotMatched: 'discard' } }
		])
		.toArray()

		return true // TODO: return if it really worked
  }
}

function archiveBlock (parent, args, context, info) {
	args.archive = true
	return both(parent, args, context, info)
}
function unarchiveBlock (parent, args, context, info) {
	args.archive = false
	return both(parent, args, context, info)
}

module.exports = {
	archiveBlock,
	unarchiveBlock,
}
