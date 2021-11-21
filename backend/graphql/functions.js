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

function getPermissionsQuery(context, roles = ['viewer', 'editor', 'owner']){
  const admin_addresses = (process.env.admin_addresses || '').split(',')
  const user_email = ((context || {}).user || {}).email || null
  if (
    admin_addresses.length > 0
    && admin_addresses.includes(user_email)
  ) {
    return {}
  }

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

	return { permissions: { $elemMatch: { $or: or } } }
}

module.exports = {
  getFilterByKeysFunction,
  getFilterByLanguageFunction,
  getPermissionsQuery,
}
