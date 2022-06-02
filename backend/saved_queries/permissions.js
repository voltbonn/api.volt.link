db.getCollection('blocks').aggregate([
  {
    $match: {
      _id: {
        $in: [
          ObjectId('6249c7bbfcaf12b1249097a5'),
          // ObjectId('6249c83cfcaf12b124911b99')
        ]
      },
    }
  },

  {
    $project: {
      root: '$$ROOT'
    }
  },

  {
    "$graphLookup": {
      "from": "blocks",
      "startWith": "$_id",
      "connectFromField": "parent",
      "connectToField": "_id",
      "as": "parentBlocks",
      "maxDepth": 50,
      "depthField": "depth",
      restrictSearchWithMatch: {
        _id: { $not: { $eq: null } },
      }
    }
  },

  { $unwind: '$parentBlocks' },
  { $unwind: '$parentBlocks.permissions./' },

  { $unset: ['parentBlocks.permissions./.tmp_id'] },
  {
    $set: {
      'parentBlocks.permissions./.depth': '$parentBlocks.depth',
    }
  },

  {
    $sort: {
      'parentBlocks.depth': 1
    }
  },


  {
    $group: {
      _id: { $concat: [{ $toString: '$root._id' }, '-', '$parentBlocks.permissions./.email'] },
      permission: { $first: '$parentBlocks.permissions./' },
      root: { $first: '$root' },
    }
  },

  {
    $group: {
      _id: '$root._id',
      permissions: { $push: '$permission' },
      root: { $first: '$root' },
    }
  },

  {
    $match: {
      "inherited_permissions": {
        "$elemMatch": {
          "$or": [
            {
              "email": "@public",
              "role": {
                "$in": [
                  "viewer",
                  "editor",
                  "owner"
                ]
              }
            },
            {
              "email": "@volteuropa.org",
              "role": {
                "$in": [
                  "viewer",
                  "editor",
                  "owner"
                ]
              }
            },
            {
              "email": "thomas.rosen@volteuropa.org",
              "role": {
                "$in": [
                  "viewer",
                  "editor",
                  "owner"
                ]
              }
            }
          ]
        }
      },
    }
  },

  {
    $set: {
      'root.computed.inherited_permissions': '$permissions'
    }
  },

  { $replaceRoot: { newRoot: '$root' } },
])
