db.getCollection('blocks').aggregate([
  {
    $match: {
      type: 'text',
      'properties.text_style': 'h2',
    }
  },
  // here is the place to check for permissions
  {
    $lookup: {
      from: 'blocks',
      let: {
        blockId: '$_id',
        parentId: '$parent',
      },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$_id', '$$parentId'] }
          }
        },
        { $limit: 1 },
        // here is the place to check for permissions
        {
          $project: {
            blockId: '$content.blockId',
          }
        },
        { $unwind: '$blockId' },
        {
          $lookup: {
            from: 'blocks',
            let: {
              blockId: '$blockId',
            },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$blockId'] }
                }
              },
            ],
            as: 'block',
          }
        },
        {
          $match: {
            $expr: { $gt: [{ $size: '$block' }, 0] }
          }
        },
        {
          $replaceRoot: {
            newRoot: { $first: '$block' }
          }
        },
        // here is the place to check for permissions
      ],
      as: 'next_content',
    }
  },
  {
    $set: {
      start: {
        $add: [1, {
          $indexOfArray: [
            { $map: { input: '$next_content', as: 'block', in: '$$block._id' } },
            '$_id'
          ]
        }]
      }
    }
  },
  {
    $set: {
      end: {
        $indexOfArray: [
          { $map: { input: '$next_content', as: 'block', in: '$$block.properties.text_style' } },
          'h2',
          {
            $cond: {
              if: { $lt: ['$start', 0] },
              then: 0,
              else: { $ifNull: ['$start', 0] }
            }
          },
        ]
      },
    }
  },
  {
    $set: {
      end: {
        $cond: {
          if: { $lt: ['$end', '$start'] },
          then: { $size: '$next_content' },
          else: { $ifNull: ['$end', { $size: '$next_content' }] }
        }
      },
    }
  },
  {
    $set: {
      amount: { $subtract: ['$end', '$start'] },
    }
  },
  {
    $set: {
      next_content: {
        $cond: {
          if: { $lte: ['$amount', 0] },
          then: [],
          else: { $slice: ['$next_content', '$start', '$amount'] }
        }
      },
    }
  },
])
