db.getCollection('blocks').aggregate([
  {
    $match: {
      _id: { $ne: null },
      type: { $ne: 'website' },
    }
  },
  {
    $set: {
      contentIds: {
        $map:
        {
          input: '$content',
          as: 'contentConfig',
          in: '$$contentConfig.blockId'
        }
      }
    }
  },
  {
    $set: {
      contentIds: {
        $cond: {
          if: { $eq: [null, '$contentIds'] },
          then: [],
          else: '$contentIds'
        }
      }
    }
  },

  {
    $lookup: {
      from: 'blocks',
      let: {
        parentId: '$_id',
        contentIds: '$contentIds'
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$parent', '$$parentId'] },
                { $not: { $in: ['$_id', '$$contentIds'] } },
                { $not: { $eq: ['$properties.archived', true] } }
              ]
            }
          }
        },
      ],
      as: 'children'
    }
  },

  {
    $match: {
      'children': { $not: { $size: 0 } }
    }
  },

  {
    $set: {
      content: {
        $concatArrays: [
          '$content',
          {
            $map:
            {
              input: '$children',
              as: 'block',
              in: { blockId: '$$block._id' }
            }
          }
        ]

      }
    }
  },
  { $unset: ['children', 'contentIds'] },

  // { $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
]) // .toArray().length
