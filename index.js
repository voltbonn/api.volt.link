require('dotenv').config()

const express = require('express')
const { getFile } = require('./git_functions.js')
const yaml = require('js-yaml')

const app = express()
app.use(express.json())

app.get('/', (req, res) => {
  // res.redirect('https://www.volteuropa.org/')
  res.send('Volt Europa')
})

app.get('/:code', (req, res) => {
  console.log('req.params', req.params)
  getFile(req.params.code)
    .then(content => {
      if (!!content) {
        const content_parsed = yaml.load(content)
        if (!!content_parsed.redirect && content_parsed.redirect !== '') {
          res.redirect(content_parsed.redirect)
        } else {
          res.send(`${JSON.stringify(content_parsed, null, 2)}`)
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
