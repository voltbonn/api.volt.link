const { getPermissionsQuery } = require('../functions.js')
const { copyManyToHistory } = require('../history.js')

async function both (parent, args, context, info) {
	const mongodb = context.mongodb

	if (!context.logged_in) {
		throw new Error('Not logged in.')
	} else {

		// 1. find all children and it's content blocks
		let blockIdsToAddToHistory = await mongodb.collections.blocks.aggregate([
	    { $match: {
	      _id: args._id,
	      ...getPermissionsQuery(context, ['editor', 'owner']),
	    } },
    
    	{ $facet: {
    	  fromOriginal: [], // empty stages-array to copy the original document/block
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
    	  blocks: { $setUnion: [ '$fromOriginal', '$fromContent', '$fromParent' ] }
    	}},
    
    	{ $unwind: '$blocks' },
    	{ $replaceRoot: { newRoot: '$blocks' } },
    
    	// ...getPermissionsAggregationQuery(context, ['editor', 'owner']),

			{ $project: { _id: true } },

    	// { $merge: { into: 'blocks', on: '_id', whenMatched: 'replace', whenNotMatched: 'discard' } }
		])
		.toArray()

		blockIdsToAddToHistory = blockIdsToAddToHistory
		.map(block => block._id)

		// 2. mark all found blocks as archived (or unarchived)
		const set_or_unset_stage = []
		if (args.archive === false) {
			set_or_unset_stage.push({ $unset: 'properties.archived' })
		} else {
			set_or_unset_stage.push({ $set: { 'properties.archived': true } })
		}

		await mongodb.collections.blocks.aggregate([
	    { $match: {
	      _id: { $in: blockIdsToAddToHistory },
	    } },

    	...set_or_unset_stage,

			{ $merge: { into: 'blocks', on: '_id', whenMatched: 'replace', whenNotMatched: 'discard' } }
		])
		.toArray()


		// 3. save changes to history
		await copyManyToHistory(blockIdsToAddToHistory, mongodb)


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
