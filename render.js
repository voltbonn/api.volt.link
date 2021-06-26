const fs = require('fs')
const path = require('path')

const { negotiateLanguages, acceptedLanguages } = require('@fluent/langneg')

const {
  readCache,
} = require('./git_functions.js')

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

function renderErrorPage(error) {
  let memeFilename = null

  try {
    let files = fs.readdirSync('./public/public/memes/')
    files = files
      .filter(file => path.extname(file).toLowerCase() === '.jpg')
      .filter(Boolean)

    memeFilename = files[Math.floor(Math.random() * files.length)]
  } catch (error) {
    console.error(error)
  }

  return `
<!DOCTYPE html>
<html lang="en">
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

  <title>volt.link Error</title>

  <style>
  .meme {
    width: 400px;
    max-width: 100%;
    margin: 32px 0;
    border: 10px solid #502379;
  }
  </style>
</head>
<body>
<div class="app spine_aligned" dir="auto">
<main class="contentWrapper">
  <h1>This is an error page!</h1>
  <p>
    There was a problem or we couldn't find the page associated with this url.<br>
    Please contact <!--sse--><a href="mailto:thomas.rosen@volteuropa.org">thomas.rosen@volteuropa.org</a><!--/sse--> for further information.
  </p>
  <p>Go to <a href="https://volteuropa.org">volteuropa.org</a> for information about the Pan-European Political Movement.</p>
  <br />
  <h3>Here's a meme for your entertainment:</h3>
  ${
    memeFilename !== null
    ? `<a href="https://volt.link/memes/"><img class="meme" src="/public/memes/${memeFilename}" /></a>`
    : ''
  }
  <br />
  <h3>Detailed error message:</h3>
  <pre><code>${JSON.stringify(error, null, 2)}</code></pre>
  </main>
</div>
</body>
</html>
    `
}

function renderLoginPage({
  code = '',
  acceptLanguage = 'en'
}) {
  if (typeof acceptLanguage !== 'string' || acceptLanguage === '') {
    acceptLanguage = 'en'
  }

  const userLocales = acceptedLanguages(acceptLanguage)

  const translations = {
    title: fluentByObject({
      en: 'This page is Volt only!'
    }, userLocales),
    description: fluentByObject({
      en: 'You need to login with a Volt Europa account to view this page.<br/>Contact your local community lead if you are unsure about your Volt Europa account.'
    }, userLocales),
    login_button: fluentByObject({
      en: 'Login',
    }, userLocales)
  }

  const locales = ['en']
  const global_locale = negotiateLanguages(
    userLocales,
    locales,
    {
      defaultLocale: locales[0],
      strategy: 'lookup'
    }
  )

  const canonical = !!code && code !== '' ? `https://volt.link/${code}` : 'https://volt.link/'

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
      <title>${translations.title}</title>

      <link rel="canonical" href="${canonical}" />
      <link rel="me" href="https://twitter.com/volteuropa" />

      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "url": "${canonical}"
        }
      </script>

      <link rel="preload" href="/Ubuntu/ubuntu-v15-latin-regular.woff2" as="font" type="font/woff2" crossorigin />
      <link rel="preload" href="/Ubuntu/ubuntu-v15-latin-700.woff2" as="font" type="font/woff2" crossorigin/>
    </head>
    <body>
      <div class="app spine_aligned" dir="auto">
        <main class="contentWrapper">
          <h1>${translations.title}</h1>
          <br />
          <p>${translations.description}</p>
          <a href="https://volt.link/login?redirect_to=${encodeURIComponent(canonical)}">
            <button style="margin-left: 0; margin-right: 0;">${translations.login_button}</button>
          </a>
        </main>
      </div>
    </body>
  </html>
  `
}

function renderMicropage({
  code = '',
  locales,
  layout = '',
  title: title_text = '',
  description: description_text = '',
  coverphoto: coverphoto_url = '',
  overwrites = {},
  items = [],
  last_modified = new Date(),
  acceptLanguage = 'en',
  logged_in = false,
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
    }, userLocales),
    logout: fluentByObject({
      en: 'Logout',
      de: 'Abmelden'
    }, userLocales),
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

  layout = (
    (layout === 'default' || layout === 'person')
      ? layout
      : (
        code.includes('.')
          ? 'person'
            : 'default'
      )
  )

  coverphoto_url = coverphoto_url || ''
  let coverphoto = ''
  if (coverphoto_url !== '') {
    if (layout === 'default') {
      coverphoto = `<div style="background-image: url(${coverphoto_url});" class="coverphoto"></div>`
    } else {
      coverphoto = `<div style="background-image: url(${coverphoto_url});" class="coverphoto">
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" />
      </div>`
    }
  }

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
      <div class="app spine_aligned ${layout}" dir="auto">
        ${layout === 'default' ? coverphoto : ''}
        <main class="contentWrapper">
          ${layout === 'person' ? coverphoto : ''}
          ${title}
          ${description}
          ${items}
        </main>
      </div>
      <footer>
        ${
          [
            `<a href="${imprint_link}">${translations.imprint}</a>`,
            `<a href="${privacy_policy_link}">${translations.privacy_policy}</a>`,
            (logged_in ? `<a href="https://volt.link/logout?redirect_to=${encodeURIComponent(canonical)}">${translations.logout}</a>` : false),
          ]
          .filter(Boolean)
          .join('&nbsp; • &nbsp;')
        }
      </footer>
    </body>
  </html>
  `
}

async function renderOverviewItems({ items, userLocales, logged_in }) {
  // const translations = {
  //   linklist: fluentByObject({
  //     en: 'Micropage',
  //     de: 'Microseite'
  //   }, userLocales),
  //   redirect: fluentByObject({
  //     en: 'Redirect',
  //     de: 'Weiterleitung'
  //   }, userLocales),
  // }

  return `<div class="items">
    ${items
      .filter(entry => {
        let { permissions } = entry[1]

        let needsToLogin = false
        if (!logged_in) {
          if (
            !!permissions
            && Array.isArray(permissions)
            && permissions.length > 0
          ) {
            needsToLogin = permissions.filter(p => p.role === 'viewer' && p.value === '@volteuropa.org').length > 0
          }
        }

        return !needsToLogin
      })
      .map(entry => {
        const code = entry[0]
        let {
          use_as,
          title,
          description,
          permissions,
          last_modified,
        } = entry[1]

        title = fluentByAny(title, userLocales, '')
        if (title === '') {
          title = code
        }

        description = fluentByAny(description, userLocales, '')

        return `<div>
          <a href="https://volt.link/${code}"><h2 dir="auto" tabindex="0" style="display: inline-block;">${title}</h2></a>
          ${description !== '' ? `<p dir="auto">${description.replace(/\n+/g, '\n').split('\n').join('<br>')}</p>` : ''}
          <p><code>
            ${new Date(last_modified).toISOString().replace('T', ' ').replace(/\..+/, '')}
            <a href="https://volt.link/${code}" style="text-decoration: none;"><code>/${code}</code></a>
          </code></p>
        </div>`
      })
      .filter(Boolean)
      .join('')
    }
  </div>`
}

async function renderOverview({
  acceptLanguage = 'en',
  logged_in = false,
  query = {},
  filter = '',
}) {
  const canonical = `https://volt.link/list/${filter}`

  if (typeof acceptLanguage !== 'string' || acceptLanguage === '') {
    acceptLanguage = 'en'
  }

  const userLocales = acceptedLanguages(acceptLanguage)

  const translations = {
    title: fluentByObject({
      en: 'All Micropages and Redirects',
      de: 'All Microseiten und Weiterleitungen'
    }, userLocales),
    description: fluentByObject({
      en: 'Here you can view a list of all micropages and redirect hosted on volt.link.',
      de: 'Hier kannst Du eine Liste aller auf volt.link gehosteten Micropages und Redirects einsehen.',
    }, userLocales),

    hidden_links_info: fluentByObject({
      en: `Some links are hidden. <a href="https://volt.link/login?redirect_to=${encodeURIComponent(canonical)}">Login with your Volt Europa account</a> to view them.`,
      de: `Einige Links sind ausgeblendet. <a href="https://volt.link/login?redirect_to=${encodeURIComponent(canonical)}">Melde Dich mit Deinem Volt Europa-Konto an</a>, um sie zu sehen.`,
    }, userLocales),

    imprint: fluentByObject({
      en: 'Imprint',
      de: 'Impressum'
    }, userLocales),
    privacy_policy: fluentByObject({
      en: 'Privacy Policy',
      de: 'Datenschutz'
    }, userLocales),
    logout: fluentByObject({
      en: 'Logout',
      de: 'Abmelden'
    }, userLocales),

    micropages: fluentByObject({
      en: 'Micropages',
      de: 'Microseiten'
    }, userLocales),
    redirects: fluentByObject({
      en: 'Redirects',
      de: 'Weiterleitungen'
    }, userLocales),
    people: fluentByObject({
      en: 'People',
      de: 'Personen'
    }, userLocales),
  }

  const locales = ['en', 'de']
  let global_locale = negotiateLanguages(
    userLocales,
    locales,
    {
      defaultLocale: locales[0],
      strategy: 'lookup'
    }
  )

  const items = Object.entries(await readCache())

  let the_list = null
  let the_menu = ''

  if (typeof filter !== 'string' || filter === '') {
    filter = 'micropages'
  }

  switch (filter) {
    case 'micropages':
      the_list = items.filter(entry => !entry[0].includes('.') && (entry[1].use_as === 'micropage' || entry[1].use_as === 'linklist'))
      break
    case 'redirects':
      the_list = items.filter(entry => !entry[0].includes('.') && entry[1].use_as === 'redirect')
      break
    case 'people':
      the_list = items.filter(entry => entry[0].includes('.'))
      break
  }

  if (the_list !== null) {
    let filters = ['micropages', 'redirects', 'people']
    the_menu = `
      <div class="buttonRow usesLinks">
      ${filters
        .map(filter_name => {
          if (filter_name === filter) {
            return `<a><button class="choosen">${translations[filter_name]}</button></a>`
          }
          return `<a href="/list/${filter_name}"><button>${translations[filter_name]}</button></a>`
        })
        .join(' ')
      }
      </div>
    `
    the_list = await renderOverviewItems({ items: the_list, userLocales, logged_in })
  } else {
    the_list = ''
  }

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
      <title>${translations.title}</title>

      <link rel="canonical" href="${canonical}" />
      <link rel="me" href="https://twitter.com/volteuropa" />
      <meta name="description" content="${translations.description}" />
      <meta itemprop="name" content="${translations.title}" />
      <meta itemprop="description" content="${translations.description}" />

      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "url": "${canonical}"
        }
      </script>

      <link rel="preload" href="/Ubuntu/ubuntu-v15-latin-regular.woff2" as="font" type="font/woff2" crossorigin />
      <link rel="preload" href="/Ubuntu/ubuntu-v15-latin-700.woff2" as="font" type="font/woff2" crossorigin/>

      <style>
        :root {
          --basis: 0.4rem;
        }
      </style>
    </head>
    <body>
      <div class="app spine_aligned" dir="auto">
        <main class="contentWrapper">
          <h1>${translations.title}</h1>
          <br>
          <p>${translations.description}</p>
          ${!logged_in ? `<p>${translations.hidden_links_info}</p>` : ''}
          <br>
          ${the_menu}
          ${the_list}
        </main>
      </div>
      <footer>
        ${
          [
            `<a href="https://www.volteuropa.org/legal">${translations.imprint}</a>`,
            `<a href="https://www.volteuropa.org/privacy">${translations.privacy_policy}</a>`,
            (logged_in ? `<a href="https://volt.link/logout?redirect_to=${encodeURIComponent(canonical)}">${translations.logout}</a>` : false),
          ]
          .filter(Boolean)
          .join('&nbsp; • &nbsp;')
        }
      </footer>
    </body>
  </html>
  `
}

module.exports = {
  renderErrorPage,
  renderLoginPage,
  renderMicropage,
  renderOverview,
}
