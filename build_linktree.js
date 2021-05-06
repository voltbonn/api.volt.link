const { negotiateLanguages, acceptedLanguages } = require('@fluent/langneg')

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
    if (result.length > 0) {
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

function build({
  locales,
  title: title_text = '',
  description: description_text = '',
  coverphoto: coverphoto_url = '',
  overwrites = {},
  items = []
}, { acceptLanguage }) {
  if (typeof acceptLanguage !== 'string' || acceptLanguage === '') {
    acceptLanguage = 'en'
  }

  const {
    imprint = '',
    privacy_policy = ''
  } = overwrites

  const userLocales = acceptedLanguages(acceptLanguage)

  const translations = {
    imprint: fluentByObject({
      en: 'Imprint',
      de: 'Impressum'
    }, userLocales),
    privacy_policy: fluentByObject({
      en: 'Privacy Policy',
      de: 'Datenschutz'
    }, userLocales)
  }

  let global_locale = 'en'
  if (!!locales && Array.isArray(locales) && locales.length > 0) {
    global_locale = negotiateLanguages(
      userLocales,
      locales,
      {
        defaultLocale: locales[0],
        strategy: 'lookup'
      }
    )
  }

  const coverphoto = (
    !!coverphoto_url
      ? `<div style="background-image: url(${coverphoto_url});" class="coverphoto"></div>`
      : ''
  )

  const default_title_text = 'Volt Europa'
  title_text = fluentByAny(title_text, userLocales, default_title_text)
  const title = (title_text !== '' ? `<h1>${title_text}</h1>` : '')

  const default_description_text = ''
  description_text = fluentByAny(description_text, userLocales, default_description_text)
  const description = (description_text !== '' ? `<p>${description_text.replace(/\n/g, '<br/>')}</p>` : '')

  items = (
    !!items && !!items
      ? `<div class="items">
        ${
          items.map(({ active, type, title, link }) => {
            if (active === false) {
              return null
            } else if (!!title && !!link) {
              title = fluentByAny(title, userLocales, '')
              return `<a href="${link}"><button>${title}</button></a>`
            } else if (type === 'headline' && !!title) {
              title = fluentByAny(title, userLocales, '')
              return `<h2>${title}</h2>`
            }
            return null
          })
          .filter(Boolean)
          .join('')
        }
      </div>`
      : ''
  )

  const imprint_link = (
    !!imprint && !!imprint !== ''
      ? imprint
      : 'https://www.volteuropa.org/legal'
  )

  const privacy_policy_link = (
    !!privacy_policy && !!privacy_policy !== ''
      ? privacy_policy
      : 'https://www.volteuropa.org/privacy'
  )

  return `
  <!DOCTYPE html>
  <html lang="${global_locale}">
    <head>
      <meta charset="utf-8" />
      <link rel="icon" href="/volt-logo-white-64.png" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#502379" />
      <meta
        name="description"
        content="${description_text.length > 0 ? description_text : default_description_text}"
      />
      <link rel="apple-touch-icon" href="/volt-logo-white-192.png" />
      <link rel="manifest" href="/manifest.json" />

      <link rel="stylesheet" href="/index.css" type="text/css">
      <link rel="stylesheet" href="/Ubuntu/index.css" type="text/css">
      <title>${title_text.length > 0 ? title_text : default_title_text}</title>

      <link rel="preload" href="/Ubuntu/ubuntu-v15-latin-regular.woff2" as="font" type="font/woff2" crossorigin />
      <link rel="preload" href="/Ubuntu/ubuntu-v15-latin-700.woff2" as="font" type="font/woff2" crossorigin/>
    </head>
    <body>
      <div class="app">
        ${coverphoto}
        ${title}
        ${description}
        ${items}
      </div>
      <footer>
        <a href="${imprint_link}">
          ${translations.imprint}
        </a>
        &nbsp; • &nbsp;
        <a href="${privacy_policy_link}">
          ${translations.privacy_policy}
        </a>
      </footer>
    </body>
  </html>
  `
}

module.exports = {
  build
}
