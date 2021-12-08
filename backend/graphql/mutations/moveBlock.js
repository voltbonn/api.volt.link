const { getPermissionsAggregationQuery } = require('../functions.js')

function changeParent(context, newParentId, movingBlockId, newPositionInContent = 0) {
	const mongodb = context.mongodb

	return new Promise((resolve, reject) => {
		if (!!newParentId) {
			mongodb.collections.blocks.aggregate([
				{$match: {_id: newParentId}},
				...getPermissionsAggregationQuery(context, ['editor', 'owner']),
			])
			.toArray()
			.then(async results => {
				if (results.length === 0) {
					reject('no permissions to edit parent')
				} else {
					// 1. save parent info to the block
					mongodb.collections.blocks.aggregate([
						{$match: { _id: movingBlockId }},
						...getPermissionsAggregationQuery(context, ['editor', 'owner']),

    				{$set: {
							parent: newParentId,
						}},

    				{ $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
					])
          .explain() // TODO: find some other way to trigger a promise
          .then(()=>{
  					// 2. remove blockId from old parent
  					mongodb.collections.blocks.aggregate([
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
            .explain() // TODO: find some other way to trigger a promise
            .then(()=>{
    					// 3. add blockId to content of parent
    					mongodb.collections.blocks.aggregate([
        				{$match: { _id: newParentId }},
    						...getPermissionsAggregationQuery(context, ['editor', 'owner']),

        				{ $set: { content: { $concatArrays: [ '$content', [{
        				    blockId: movingBlockId
        				}] ] } } },

        				{ $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
    					])
              .explain() // TODO: find some other way to trigger a promise
              .then(()=>{
    					  resolve()
              })
              .catch(reject)
            })
            .catch(reject)
          })
          .catch(reject)
				}
			})
			.catch(reject)
		}else{
			reject('newParentId is probably not a mongoId')
		}
	})
}

module.exports = (parent, args, context, info) => {
	return new Promise((resolve,reject)=>{
		if (!context.logged_in) {
			reject('Not logged in.')
		} else {
			const movingBlockId = args.movingBlockId
			const newParentId = args.newParentId
			const newPositionInContent = args.newIndex

      changeParent(context, newParentId, movingBlockId, newPositionInContent)
      .then(()=>{
        resolve(true)
      })
      .catch(reject)
		}
	})
}
