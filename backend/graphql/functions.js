const { negotiateLanguages } = require('@fluent/langneg')
const { copyManyToHistory } = require('./history.js')

function getFilterByKeysFunction(graphqlKey) {
  return (parent, args, context, info) => {
    if (!!args.keys && args.keys.length > 0) {
      const keys = args.keys
      return (
        Object.entries(parent[graphqlKey])
        // .filter(pair => keys.includes(pair[0]))
        // .reduce((obj,pair)=>{
        //   obj[pair[0]] = pair[1]
        //   return obj
        // },{})
        .reduce((obj,pair)=>{
          const truth = keys.reduce((bool,key) => {
            return bool || pair[0].startsWith(key) // || `"${pair[0]}"` === key
          },false)

          if (truth) {
            obj[pair[0]] = pair[1]
          }
          
          return obj
        },{})
      )
    }
    return parent[graphqlKey]
  }
}

function getFilterByLanguageFunction(graphqlKey){
  return (parent, args, context, info) => {
    let dbValue = parent[graphqlKey]
    if (!(
      !!dbValue && Array.isArray(dbValue)
    )) {
      if (!!dbValue) {
        dbValue = [{
          text: dbValue,
          language: null,
        }]
      }else{
        dbValue = []
      }
    }

    // if (!!args.languages && args.languages.length > 1) { // should have more than one entry. Otherwise, theres nothing to filter about
    //   const languages = args.languages // [...new Set(args.languages).add('en')] // make sure english i ever returned as the default language
    //   return dbValue.filter(entry => entry.language === null || languages.includes(entry.language))
    // }

    if (!!args.languages && args.languages.length > 1) {
      const currentLocales = negotiateLanguages(
        args.languages,
        dbValue.map(entry => entry.language).filter(language => language !== null),
        { defaultLocale: 'en' }
      )

      return dbValue.filter(entry => entry.text !== null && (entry.language === null || currentLocales.includes(entry.language)))
    }

    return dbValue
  }
}

function getPermissionsQuery(context, roles = null, options = {}){
  const user_email = ((context || {}).user || {}).email || null
  
  const admin_addresses = (process.env.admin_addresses || '').split(',').filter(Boolean)
  if (
    admin_addresses.length > 0
    && admin_addresses.includes(user_email)
  ) {
    return {}
  }

  if (
    roles === null
    || (
      typeof roles !== 'object'
      && Array.isArray(roles)
    )
  ) {
    roles = ['viewer', 'editor', 'owner']
  }

  const {
    fieldName = 'permissions',
  } = options

	const or = [
    {
        email: '@public',
        role: { $in: roles }
    }
	]

	if (context.logged_in) {
    or.push({
      email: '@volteuropa.org',
      role: { $in: roles }
    })

		if (user_email) {
    	or.push({
    	  email: user_email,
    	  role: { $in: roles }
    	})
		}
	}

	return { [fieldName+'./']: { $elemMatch: { $or: or } } }
}

function getPermissionsAggregationQuery(context, roles){
  const permissionsQuery = getPermissionsQuery(context, roles, {})

  if (Object.keys(permissionsQuery).length === 0) { // Admins have empty permissionsQuery, to return everything. No aggregation needed.
    return []
  }

  const query = [
    // only leave blocks with sufficient parent permissions
    { $match: permissionsQuery },

    // Get the parents of matched blocks.
    {$graphLookup: {
        from: 'blocks',
        startWith: '$parent',
        connectFromField: 'parent',
        connectToField: '_id',
        as: 'parents',
        maxDepth: 50,
        depthField: 'computed.sort',
        // restrictSearchWithMatch: <document>
    }},

    // Add the block itself to the found results. This prevents the block from being hidden if it has no parents.
    { $set: { 'tmpRoot': '$$ROOT' } },
    { $unset: 'tmpRoot.parents' },
    { $set: { 'parents': { $concatArrays: [ ['$tmpRoot'], '$parents' ] } } },
    { $unset: 'tmpRoot' },

    // only leave blocks with sufficient parent permissions
    { $unwind: '$parents' },
    { $match: { 'parents.permissions./': permissionsQuery['permissions./'] } },

    // group the parents back to the blocks and clean up the permissions checking stuff
    { $unset: 'parents' },
    { $project: { tmpRoot: '$$ROOT' }},
    { $group: { _id: '$_id', tmpRoot: { $first: '$tmpRoot' } }},
    { $replaceRoot: { newRoot: '$tmpRoot' } },
  ]

  return query
}

function getRolesOfUser(context, permissions){
  const roles = new Set()

  const blockPermissions = permissions['/'] || []

  const indexOfPublic = blockPermissions.findIndex(p => p.email === '@public')
  if (indexOfPublic > -1) {
    roles.add(blockPermissions[indexOfPublic].role)
  }

  if (context.logged_in) {
    const user_email = ((context || {}).user || {}).email || null

    // const admin_addresses = (process.env.admin_addresses || '').split(',').filter(Boolean)
    // if (
    //   admin_addresses.length > 0
    //   && admin_addresses.includes(user_email)
    // ) {
    //   roles.add('admin')
    // }

    const indexOfUser = blockPermissions.findIndex(p => p.email === user_email)
    if (indexOfUser > -1) {
      roles.add(blockPermissions[indexOfUser].role)
    }

    const indexOfInternal = blockPermissions.findIndex(p => p.email === '@volteuropa.org')
    if (indexOfInternal > -1) {
      roles.add(blockPermissions[indexOfInternal].role)
    }
  }

  return [...roles]
}

async function changeParent(context, newParentId, movingBlockId, newPositionInContent = -1) {
  const mongodb = context.mongodb

  if (!!newParentId) {
    const results = await mongodb.collections.blocks
      .aggregate([
        { $match: { _id: newParentId } },
        ...getPermissionsAggregationQuery(context, ['editor', 'owner']),
      ])
      .toArray()

    if (results.length === 0) {
      throw new Error('no permissions to edit parent')
    } else {

      // 1. save parent info to the block
      await mongodb.collections.blocks
        .aggregate([
          { $match: { _id: movingBlockId } },
          ...getPermissionsAggregationQuery(context, ['editor', 'owner']),

          {
            $set: {
              parent: newParentId,
            }
          },

          { $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
        ])
        .toArray()

      // 2.1. get ids of old parents
      let oldParentIds = await mongodb.collections.blocks
        .aggregate([
          { $match: { 'content.blockId': movingBlockId } },
          ...getPermissionsAggregationQuery(context, ['editor', 'owner']),

          {
            $project: {
              _id: true
            }
          },
        ])
        .toArray()

      oldParentIds = oldParentIds.map(id => id._id)

      // 2.2: remove blockId from old parent
      await mongodb.collections.blocks
        .aggregate([
          { $match: { 'content.blockId': movingBlockId } },
          ...getPermissionsAggregationQuery(context, ['editor', 'owner']),

          {
            $redact: {
              $cond: {
                if: { $eq: ["$blockId", movingBlockId] },
                then: "$$PRUNE",
                else: "$$DESCEND"
              }
            }
          },

          { $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
        ])
        .toArray()

      // 3. add blockId to content of parent
      await mongodb.collections.blocks
        .aggregate([
          { $match: { _id: newParentId } },
          ...getPermissionsAggregationQuery(context, ['editor', 'owner']),

          {
            $set: {
              content: {
                $concatArrays: ['$content', [
                  // Add a new content-config at the end.
                  // TODO: Use newPositionInContent to add the content-config at a specific index. -1 should add it to the end.
                  {
                    blockId: movingBlockId
                  }
                ]]
              }
            }
          },

          { $merge: { into: "blocks", on: "_id", whenMatched: "replace", whenNotMatched: "discard" } }
        ])
        .toArray()

      // 4. copy all changed blocks to the history collection
      const blockIdsToAddToHistory = [...new Set([
        movingBlockId,
        newParentId,
        ...oldParentIds,
        newParentId,
      ])]

      await copyManyToHistory(blockIdsToAddToHistory, mongodb)

      // 5. finish
      return true

    }
  } else {
    throw new Error('newParentId is probably not a mongoId')
  }
}

module.exports = {
  getFilterByKeysFunction,
  getFilterByLanguageFunction,
  getPermissionsQuery,
  getPermissionsAggregationQuery,
  getRolesOfUser,
  changeParent,
}
