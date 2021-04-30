require('dotenv').config()

const express = require('express')
const { getFile } = require('./git_functions.js')
const { build } = require('./build_linktree.js')
const yaml = require('js-yaml')

const app = express()
app.use(express.json())

app.use(express.static('public'))

app.get('/', (req, res) => {
  // res.redirect('https://www.volteuropa.org/')
  res.send(`
<html lang="en">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
body {
  font-family: Ubuntu, sans-serif;
  color: #502379;
  padding: 32px;
}
a,
a:visited {
  color: #502379;
}
a:hover {
  opacity: 0.7;
}
</style>
</head>
<body>
  <h1>Redirect Server for Volt Europa</h1>
  <!--sse-->Contact: <a href="mailto:thomas.rosen@volteuropa.org">thomas.rosen@volteuropa.org</a></br><!--/sse-->
  Example: <a href="https://volt.link/bonn">volt.link/bonn</a>
</body>
</html>
`)
})

app.get('/:code', (req, res) => {
  getFile(req.params.code)
    .then(content => {
      if (!!content) {
        const content_parsed = yaml.load(content)

        let useAs = null
        if (content_parsed.hasOwnProperty('useAs')) {
          useAs = content_parsed.useAs
        }

        const hasUseAs = useAs !== null
        const hasRedirect = !!content_parsed.redirect && content_parsed.redirect !== ''
        const hasLinktree = !!content_parsed.linktree

        if (
          hasRedirect
          && (useAs === 'redirect' || !hasUseAs)
        ) {
          res.redirect(content_parsed.redirect)
        } else if (
          hasLinktree
          && (useAs === 'linktree' || !hasUseAs)
        ) {
          res.send(build(content_parsed.linktree))
        } else {
          res.redirect('/')
        }
      } else {
        res.redirect('/')
      }
    })
})

const port = 4000
const host = '0.0.0.0' // Uberspace wants 0.0.0.0
app.listen({ port, host }, () =>
  console.info(`
    🚀 Server ready
    View the API at http://${host}:${port}/
    http://${host}:${port}/:code
  `)
)
