db.getCollection('blocks').aggregate([



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
                { $not: { $in: ['$_id', '$$contentIds'] } }
              ]
            }
          }
        },
      ],
      as: 'children'
    }
  },
  { $unwind: '$children' },

  // { $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
]) // .toArray().length
