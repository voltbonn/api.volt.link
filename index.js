require('dotenv').config()

const express = require('express')
const { getFile } = require('./git_functions.js')
const yaml = require('js-yaml')

const app = express()
app.use(express.json())

app.get('/', (req, res) => {
  // res.redirect('https://www.volteuropa.org/')
  res.send(`
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
<body>
  <h1>Redirect Server for Volt Europa</h1>
  Contact: <a href="mailto:thomas.rosen@volteuropa.org">thomas.rosen@volteuropa.org</a></br>
  Example: <a href="https://volt.link/bonn">volt.link/bonn</a>
</body>
`)
})

app.get('/:code', (req, res) => {
  getFile(req.params.code)
    .then(content => {
      if (!!content) {
        const content_parsed = yaml.load(content)
        if (!!content_parsed.redirect && content_parsed.redirect !== '') {
          res.redirect(content_parsed.redirect)
        } else {
          res.redirect('/')
          // res.send(`${JSON.stringify(content_parsed, null, 2)}`)
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
