db.getCollection('blocks').aggregate([
  {
    $match: {
      _id: { $not: { $eq: null } },
      'properties.action.type': 'open_url',
      'properties.action.url': { $exists: true }
    }
  },

  {
    $set: {
      'properties.url': '$properties.action.url'
    }
  },
  {
    $unset: [
      'properties.action'
    ]
  },

  // { $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } },
])











db.getCollection('blocks').aggregate([
  {
    $match: {
      _id: { $not: { $eq: null } },
      'properties.trigger.type': 'path',
      'properties.trigger.path': { $exists: true }
    }
  },

  {
    $set: {
      'properties.slug': '$properties.trigger.path'
    }
  },
  {
    $unset: [
      'properties.trigger'
    ]
  },

  // { $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } },
])













db.getCollection('blocks').aggregate([
  {
    $match: {
      _id: { $not: { $eq: null } },
      'properties.trigger.type': 'click',
    }
  },

  {
    $unset: [
      'properties.trigger'
    ]
  },

  // { $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } },
])












db.getCollection('blocks').aggregate([
  {
    $match: {
      _id: { $not: { $eq: null } },
      'properties.action.type': 'render_block',
    }
  },

  {
    $unset: [
      'properties.action'
    ]
  },

  // { $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } },
])
