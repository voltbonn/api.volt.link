db.getCollection('blocks').aggregate([
  {
    $match: {
      _id: { $not: { $eq: null } },
      type: { $not: { $in: ['page', 'person', 'redirect'] } }
    }
  },

  {
    $set: {
      'permissions./': {
        $filter: {
          input: '$permissions./',
          as: 'p',
          cond: { $eq: ['$$p.role', 'owner'] }
        }
      },
    }
  },
  
  // {
  //   $set: {
  //     'permissions./': {
  //       $setDifference: [
  //         {
  //           $map: {
  //             input: '$permissions./',
  //             as: 'p',
  //             in: {
  //               $cond: [
  //                 { $eq: ['$$p.role', 'owner'] },
  //                 '$$p',
  //                 false
  //               ]
  //             }
  //           }
  //         },
  //         [false]
  //       ]
  //     },
  //   }
  // },

  // { $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
])
