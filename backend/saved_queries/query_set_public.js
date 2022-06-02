db.getCollection('blocks').aggregate([
  {
    $match: {
      _id: { $not: { $eq: null } },
      'permissions./': {
        $not: {
          $elemMatch: {
            email: "@public",
            role: {
              $in: [
                "no_access",
                "viewer",
                "editor",
                "owner"
              ]
            }
          }
        }
      },
    }
  },

  {
    $set: {
      'permissions./': {
        $concatArrays: [
          '$permissions./',
          [{
            "email": "@public",
            "role": "no_access"
          }]
        ]
      }
    }
  },

  //{ $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
])
