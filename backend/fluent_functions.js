const { negotiateLanguages } = require('@fluent/langneg')

function fluentByObject(object = {}, userLocales = ['en']){
  const supportedLocales = Object.keys(object)

  if (supportedLocales.length === 0) {
    return null
  }

  const lookupedLocale = negotiateLanguages(
    userLocales,
    supportedLocales,
    {
      defaultLocale: supportedLocales[0],
      strategy: 'lookup',
    }
  )

  if (lookupedLocale.length === 0) {
    return null
  }

  return object[lookupedLocale[0]]
}

function fluentByArray(array = [], userLocales = ['en'], key = 'locale') {
  const supportedLocales = array.map(item => item[key]).filter(Boolean)

  if (supportedLocales.length === 0) {
    return null
  }

  const lookupedLocale = negotiateLanguages(
    userLocales,
    supportedLocales,
    {
      defaultLocale: supportedLocales[0],
      strategy: 'lookup',
    }
  )

  if (lookupedLocale.length === 0) {
    return null
  }

  return array.filter(item => item[key] === lookupedLocale[0])
}

function fluentByAny(any = '', userLocales = ['en'], fallback = '') {
  if (Array.isArray(any)) {
    const result = fluentByArray(any, userLocales)
    if (Array.isArray(result) && result.length > 0) {
      any = result[0].value
    }
  } else if (typeof any === 'object') {
    any = fluentByObject(any, userLocales)
  }
  if (typeof any !== 'string') {
    any = fallback
  }
  return any
}

module.exports = {
  fluentByObject,
  fluentByArray,
  fluentByAny,
}
