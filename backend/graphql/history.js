async function copyToHistory (blockId, mongodb) {
  // only copy if blockId was given
  if (blockId === undefined || blockId === null) {
    return false
  }

  // check if blockId is a valid ObjectId
  if (!mongodb.ObjectId.isValid(blockId)) {
    throw new Error('Invalid blockId.')
  }

	return await mongodb.collections.blocks.aggregate([
		{ $match: {
      _id: blockId,
    }},

    { $addFields: {
      isHistoryFor: '$_id'
    }},
    { $unset: '_id' },

 		{ $merge: { into: 'history' } }
	])
	.toArray()
}

async function copyManyToHistory (blockIds, mongodb) {
  blockIds = blockIds.filter(blockId => mongodb.ObjectId.isValid(blockId))

	return await mongodb.collections.blocks.aggregate([
		{ $match: {
      _id: { $in: blockIds },
    }},

    { $addFields: {
      isHistoryFor: '$_id'
    }},
    { $unset: '_id' },

 		{ $merge: { into: 'history' } }
	])
	.toArray()
}

module.exports = {
  copyToHistory,
  copyManyToHistory,
}
