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

        <main class="contentWrapper">
function build({
  code = '',
  locales,
  title: title_text = '',
  description: description_text = '',
  coverphoto: coverphoto_url = '',
  overwrites = {},
  items = [],
  last_modified = new Date(),
  acceptLanguage = 'en'
}) {
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

  coverphoto_url = coverphoto_url || ''
  const coverphoto = (
    coverphoto_url !== ''
      ? `<div style="background-image: url(${coverphoto_url});" class="coverphoto"></div>`
      : ''
  )

  const default_title_text = 'Volt Europa'
  title_text = fluentByAny(title_text, userLocales, default_title_text)
  const title = (title_text !== '' ? `<h1 dir="auto">${title_text}</h1>` : '')
  title_text = title_text.length > 0 ? title_text : default_title_text

  const default_description_text = ''
  description_text = fluentByAny(description_text, userLocales, default_description_text)
  const description = (description_text !== '' ? `<p dir="auto">${description_text.replace(/\n/g, '<br/>')}<br/><br/></p>` : '')
  description_text = description_text.length > 0 ? description_text : default_description_text

  items = (
    !!items && !!items
      ? `<div class="items">
        ${
          items.map(({ active, type, title, text, link }) => {
            if (active === false) {
              return null
            } else if (!!title && !!link) {
              title = fluentByAny(title, userLocales, '')
              return `<div><a href="${link}"><button dir="auto">${title}</button></a></div>`
            } else if (typeof type === 'string' && type.startsWith('headline') && !!title) {
              title = fluentByAny(title, userLocales, '')
              if (type === 'headline3') {
                return `<h3 dir="auto">${title}</h3>`
              } else {
                return `<h2 dir="auto">${title}</h2>`
              }
            } else if (type === 'text' && !!text) {
              text = fluentByAny(text, userLocales, '')
              return `<p dir="auto">${text.split('\n').join('<br/>')}</p>`
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

  const canonical = !!code && code !== '' ? `https://volt.link/${code}` : 'https://volt.link/'

  last_modified = last_modified.toUTCString()

  return `
  <!DOCTYPE html>
  <html lang="${global_locale}">
    <head>
      <meta charset="utf-8" />
      <link rel="icon" href="/volt-logo-white-64.png" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#502379" />
      <link rel="apple-touch-icon" href="/volt-logo-white-192.png" />
      <link rel="manifest" href="/manifest.json" />

      <script
        async
        defer
        data-website-id="becf9dc6-db9a-42a7-bc64-9637bd885bff"
        src="https://umami.qiekub.org/umami.js"
        data-domains="volt.link"
      ></script>

      <link rel="stylesheet" href="/index.css" type="text/css">
      <link rel="stylesheet" href="/index-overwrites.css" type="text/css">
      <link rel="stylesheet" href="/Ubuntu/index.css" type="text/css">
      <title>${title_text}</title>

      <link rel="canonical" href="${canonical}" />
      <link rel="me" href="https://twitter.com/volteuropa" />
      <meta name="description" content="${description_text}" />
      <meta itemprop="name" content="${title_text}" />
      <meta itemprop="description" content="${description_text}" />
      <meta itemprop="image" content="${coverphoto_url}" />

      <meta property="twitter:card" content="summary" />
      <meta property="twitter:title" content="${title_text}" />
      <meta property="twitter:description" content="${description_text}" />
      <meta property="twitter:site" content="@volteuropa" />
      <meta property="twitter:creator" content="@volteuropa" />
      <meta property="twitter:image" content="${coverphoto_url}" />

      <meta property="og:title" content="${title_text}" />
      <meta property="og:url" content="${canonical}" />
      <meta property="og:site_name" content="${title_text}" />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="${global_locale}" />
      <meta property="og:image" content="${coverphoto_url}" />

      <meta name="pinterest-rich-pin" content="true" />

      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "url": "${canonical}"
        }
      </script>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          "author": "Volt Europa",
          "image": "${coverphoto_url}",
          "name": "${title_text}",
          "dateModified": "${last_modified}",
          "sourceOrganization": {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Volt Europa",
            "alternateName": "Volt",
            "email": "info@volteuropa.org",
            "startDate": "2027-03-29",
            "location": "Europe",
            "areaServed": "Europa"
          },
          "identifier": "${code}",
          "url": "${canonical}",
          "maintainer": "thomas.rosen@volteuropa.org",
          "sameAs": [
            "https://en.wikipedia.org/wiki/Volt_Europa",
            "https://www.wikidata.org/wiki/Q55229798"
          ]
        }
      </script>

      <link rel="preload" href="/Ubuntu/ubuntu-v15-latin-regular.woff2" as="font" type="font/woff2" crossorigin />
      <link rel="preload" href="/Ubuntu/ubuntu-v15-latin-700.woff2" as="font" type="font/woff2" crossorigin/>
    </head>
    <body>
      <div class="app spine_aligned" dir="auto">
        ${coverphoto}
        <main class="contentWrapper">
          ${title}
          ${description}
          ${items}
        </main>
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
