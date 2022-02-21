async function copyToHistory (blockId, mongodb) {
  // check if blockId is a valid ObjectId
  if (!mongodb.ObjectId.isValid(blockId)) {
    throw new Error('Invalid blockId.')
  }

	return await mongodb.collections.blocks.aggregate([
		{ $match: {
      _id: block._id,
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
}
