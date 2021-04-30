function build(linktree){

  const coverphoto = (
    !!linktree.style && !!linktree.style.coverphoto
      ? `<div style="background-image: url(${linktree.style.coverphoto});" class="coverphoto"></div>`
      : ''
  )

  const default_title_text = 'Volt Europa'
  const title_text = (
    !!linktree.title && linktree.title !== ''
      ? linktree.title
      : ''
  )
  const title = (title_text !== '' ? `<h1>${title_text}</h1>` : '')

  const default_description_text = ''
  const description_text = (
    !!linktree.description && linktree.description !== ''
      ? linktree.description
      : ''
  )
  const description = (description_text !== '' ? `<p>${description_text.replace(/\n/g, '<br/>')}</p>` : '')

  const links = (
    !!linktree.links && !!linktree.links
      ? `<div class="links">
        ${
          linktree.links.map(({ type, title, link }) => {
            if (!!title && !!link) {
              return `<a href="${link}"><button>${title}</button></a>`
            } else if (type === 'headline' && !!title) {
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
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <meta name="theme-color" content="#502379" />
      <meta
        name="description"
        content="${description_text.length > 0 ? description_text : default_description_text}"
      />
      <link rel="stylesheet" href="/style.css" type="text/css">
      <title>${title_text.length > 0 ? title_text : default_title_text}</title>
    </head>
    <body>
      <div class="app">
        ${coverphoto}
        ${title}
        ${description}
        ${links}
      </div>
      <footer>
        <a href="${imprint_link}">
          Imprint
        </a>
        &nbsp; • &nbsp;
        <a href="${privacy_policy_link}">
          Privacy Policy
        </a>
      </footer>
    </body>
  </html>
  `
}

module.exports = {
  build
}
