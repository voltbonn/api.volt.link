function build(linktree){

  const coverphoto = (
    !!linktree.style && !!linktree.style.coverphoto
      ? `<div style="background-image: url(${linktree.style.coverphoto});" class="coverphoto"></div>`
      : ''
  )

  const title = (
    !!linktree.title && !!linktree.title !== ''
      ? `<h1>${linktree.title}</h1>`
      : ''
  )

  const description = (
    !!linktree.description && !!linktree.description !== ''
      ? `<p>${linktree.description.replace(/\n/g, '<br/>')}</p>`
      : ''
  )

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
      <link rel="stylesheet" href="/style.css" type="text/css">
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
