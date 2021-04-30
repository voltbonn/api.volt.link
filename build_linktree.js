const { negotiateLanguages, acceptedLanguages } = require('@fluent/langneg')

function fluentByObject(object, userLocales){
  const supportedLocales = Object.keys(object)

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
  } else {
    return object[lookupedLocale[0]]
  }
}

function build(linktree, { acceptLanguage }) {
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
  if (!!linktree.locales && Array.isArray(linktree.locales) && linktree.locales.length > 0) {
    global_locale = negotiateLanguages(
      userLocales,
      linktree.locales,
      {
        defaultLocale: linktree.locales[0],
        strategy: 'lookup'
      }
    )
  }

  const coverphoto = (
    !!linktree.style && !!linktree.style.coverphoto
      ? `<div style="background-image: url(${linktree.style.coverphoto});" class="coverphoto"></div>`
      : ''
  )

  const default_title_text = 'Volt Europa'
  let title_text = (
    !!linktree.title && linktree.title !== ''
      ? linktree.title
      : ''
  )
  if (typeof title_text === 'object') {
    title_text = fluentByObject(title_text, userLocales)
  }
  const title = (title_text !== '' ? `<h1>${title_text}</h1>` : '')

  const default_description_text = ''
  let description_text = (
    !!linktree.description && linktree.description !== ''
      ? linktree.description
      : ''
  )
  if (typeof description_text === 'object') {
    description_text = fluentByObject(description_text, userLocales)
  }
  const description = (description_text !== '' ? `<p>${description_text.replace(/\n/g, '<br/>')}</p>` : '')

  const items = (
    !!linktree.items && !!linktree.items
      ? `<div class="items">
        ${
          linktree.items.map(({ active, type, title, link }) => {
            if (active === false) {
              return null
            } else if (!!title && !!link) {
              if (typeof title === 'object') {
                title = fluentByObject(title, userLocales)
              }
              return `<a href="${link}"><button>${title}</button></a>`
            } else if (type === 'headline' && !!title) {
              if (typeof title === 'object') {
                title = fluentByObject(title, userLocales)
              }
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
    !!linktree.imprint && !!linktree.imprint !== ''
      ? linktree.imprint
      : 'https://www.volteuropa.org/legal'
  )

  const privacy_policy_link = (
    !!linktree.privacy_policy && !!linktree.privacy_policy !== ''
      ? linktree.privacy_policy
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
