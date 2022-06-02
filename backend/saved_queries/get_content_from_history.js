db.getCollection('blocks').aggregate([
  {
    $match: {
      $and: [
        { _id: { $ne: null } },
        { type: 'page' },
        {
          $or: [{
            // Check about no Company key
            content: {
              $exists: false
            }
          }, {
            // Check for null
            content: null
          }, {
            // Check for empty array
            content: {
              $size: 0
            }
          }]
        }
      ]
    }
  },

  {
    $lookup: {
      from: 'history',
      as: 'history_blocks',
      let: {
        block_id: '$_id',
      },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$isHistoryFor', '$$block_id'] },
          }
        },
        {
          $match: {
            content: { $exists: true, $type: 'array', $ne: [] }
          }
        },
        {
          $sort: {
            'metadata.modified': -1
          }
        },
        { $limit: 1 },
      ],
    }
  },
  {
    $set: {
      history_blocks: { $first: '$history_blocks' }
    }
  },
  {
    $set: {
      content: '$history_blocks.content'
    }
  },
  { $unset: ['history_blocks'] },
  { $merge: { into: 'blocks', on: '_id', whenMatched: 'replace', whenNotMatched: 'discard' } }
])
