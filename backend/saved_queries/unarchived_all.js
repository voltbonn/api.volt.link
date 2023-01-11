db.getCollection('blocks').aggregate([
  { $match: { 'properties.slug': 'europa' } },
  {
    $graphLookup: {
      from: 'blocks',
      startWith: '$content.blockId',
      connectFromField: 'content.blockId',
      connectToField: '_id',
      as: 'children',
      maxDepth: 1000,
      // depthField: <string>,
      // restrictSearchWithMatch: <document>
    }
  },
  { $unwind: '$children' },

  {
    $replaceRoot: {
      newRoot: '$children'
    }
  },
  {
    $match: {
      'properties.archived': true
    }
  },
  { $unset: ['properties.archived'] },

  // { $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
])
