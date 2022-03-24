const { negotiateLanguages } = require('@fluent/langneg')

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

module.exports = {
  getFilterByKeysFunction,
  getFilterByLanguageFunction,
  getPermissionsQuery,
  getPermissionsAggregationQuery,
}
