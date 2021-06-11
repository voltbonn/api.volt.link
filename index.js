require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { sendInitialStats } = require('./stats.js')

const {
  getFileContentLocal,
  doesFileExist,
  saveFile,
  gitPull,
  removeFile,
} = require('./git_functions.js')
const {
  renderErrorPage,
  renderLoginPage,
  renderMicropage,
} = require('./render.js')
const yaml = require('js-yaml')

const express = require('express')
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy

const forbidden = {
  codes: `
undefined
null
error
public
auth
auth/google
auth/google/callback
auth/failure
logout
user.json
login
forbidden_codes
pull
exists
get
set
`
  .split('\n')
  .filter(Boolean),
  letters: ' /\\\'"´`(){}[]<>,;:?!¿¡=#+|~^°',
  special_letters: '.'
}
const forbidden_letters_splitted = forbidden.letters.split('')

function quickcheckCode(code, { userEmail = '' }) {

  const username = (userEmail || '').split('@')[0]
  const code_split = code.split('')

  let allowed_to_edit = false

  if (
    code === ''
    || code.includes('/')
    || code.startsWith('volt')
    || forbidden.codes.includes(code)
    || forbidden_letters_splitted.filter(value => !code_split.includes(value)).length < forbidden_letters_splitted.length
  ) {
    allowed_to_edit = false
  } else if (code.includes('.')) {
    if (
      (username !== '' && code === username)
      || (userEmail !== '' && admin_addresses.includes(userEmail))
    ) {
      allowed_to_edit = true
    } else {
      allowed_to_edit = false
    }
  } else {
    allowed_to_edit = true
  }

  return { allowed_to_edit }
}

const admin_addresses = (process.env.admin_addresses || '').split(',')

function hasEditPermission(permissions, userEmail) {
  const permissions_array_has_content = (
    typeof permissions === 'object'
    && permissions !== null
    && Array.isArray(permissions)
    && permissions.length > 0
  )

  return (
    typeof userEmail === 'string'
    && userEmail !== ''
    && (
      admin_addresses.includes(userEmail)
      || !permissions_array_has_content
      || (
        permissions_array_has_content
        && permissions.map(e => e.value).includes(userEmail)
      )
    )
  )
}
const app = express()
app.use(express.json())

app.use(express.static('public'))

// START AUTH
async function session_middleware(req, res, next) {

  const origin = req.header('Origin')
  if (typeof origin === 'string' && origin.endsWith('localhost:3000')) { // allow for localhost
    req.headers['-x-session'] = 's%3AOiY6jEc4tS-jkKeuIuB2ubAW9Vpgkij4.HT1EkmpOPB3MxNCmGvxvLeENzyxsxJkXYq%2FmY1QafDw'
  }

  if (!!req.headers['-x-session']) {
    req.headers.cookie = '__session=' + req.headers['-x-session']
  }

  const sessionTTL = 60 * 60 * 24 * 14 // = 14 days

  session({
    name: '__session',
    secret: process.env.express_session_secret,
    cookie: {
      httpOnly: false,
      // domain: false, // for localhost
      domain: 'volt.link',
      sameSite: 'lax',
      secure: false, // somehow doesnt work when its true
      maxAge: 1000 * sessionTTL,
    },
    store: new FileStore({
      path: './sessions/',
      retries: 2,
    }),
    saveUninitialized: false, // don't create session until something stored
    resave: true, // don't save session if unmodified
    unset: 'destroy',
  })(req, res, next)
}

app.use(session_middleware)

passport.serializeUser(function (user, done) {
  done(null, user)
})
passport.deserializeUser(function (id, done) {
  done(null, id)
})

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  // callbackURL: 'http://localhost:4000/auth/google/callback', // for localhost
  callbackURL: 'https://volt.link/auth/google/callback',
},
  function (accessToken, refreshToken, profile, done) {
    if (
      !!accessToken
      && profile.hasOwnProperty('emails')
      && profile.emails.length > 0
      && profile.emails[0].verified === true
      && profile.emails[0].value.endsWith('@volteuropa.org')
      // && profile._json.hd === '@volteuropa.org'
      // && profile.provider === 'google'
    ) {
      done(null, {
        status: 'internal',
        id: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
      })
    } else {
      done(null, {
        status: 'external'
      })
      // done(new Error('Wrong Email Domain. You need to be part of Volt Europa.'), null)
    }
  }
))

app.use(passport.initialize())
app.use(passport.session())

app.use(function (req, res, next) {
  if (
    typeof req.query.redirect_to === 'string'
    && req.query.redirect_to !== ''
  ) {
    req.session.redirect_to = req.query.redirect_to + '' // TODO: Why does this need to be converted to a string? To need pass a pointer but the value?
  }

  if (!!req.user && !!req.user.id && req.user.id !== null) {
    req.logged_in = true
  } else {
    req.logged_in = false
  }

  // const origin = req.get('origin')
  const origin = req.header('Origin')
  if (
    typeof origin === 'string'
    && (origin.endsWith('.volt.link') || origin.endsWith('localhost:3000') || origin.endsWith('0.0.0.0:3000'))
  ) { // allow from subdomains
    req.is_subdomain = true
    req.origin = origin
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', true)
  } else {
    req.is_subdomain = false
  }

  next()
})

app.get('/auth/google', passport.authenticate('google', { scope: [
  'https://www.googleapis.com/auth/userinfo.email'
] }))

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureFlash: true, failureRedirect: '/auth/failure' }),
  function (req, res) {
    const redirect_to = req.session.redirect_to
    req.session.redirect_to = null
    res.redirect(typeof redirect_to === 'string' ? redirect_to : '/')
  }
)
app.get('/auth/failure', function (req, res) {
    const redirect_to = req.session.redirect_to
  res.send(`
<!DOCTYPE html>
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
  <h1>Login Error</h1>
  <p>You need to use a Volt Europa account to log in.</p>
  <!--sse-->Contact: <a href="mailto:thomas.rosen@volteuropa.org">thomas.rosen@volteuropa.org</a></br><!--/sse-->
  Go back to: <a href="${redirect_to}">${redirect_to}</a>
</body>
</html>
`)
})

app.get('/logout', function (req, res) {
  req.session.cookie.maxAge = 0 // set the maxAge to zero, to delete the cookie
  req.logout()
  res.clearCookie('__session')
  req.session.save(error => { // save the above setting
    if (error) {
      console.error(error)
    } else {
      const redirect_to = req.session.redirect_to
      req.session.redirect_to = null
      res.redirect(typeof redirect_to === 'string' ? redirect_to : '/') // send the updated cookie to the user and go to the start page
    }
  })
})
// END AUTH

app.options("/*", function (req, res, next) {
  // correctly response for cors
  if (req.is_subdomain) {
    res.setHeader('Access-Control-Allow-Origin', req.origin)
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
    res.sendStatus(200)
  } else {
    res.sendStatus(403)
  }
})

app.get('/user.json', (req, res) => {
  res.json({ user: req.user })
})

app.get('/login', (req, res) => {
  res.redirect('/auth/google')
})

app.get('/', (req, res) => {
  // res.redirect('https://www.volteuropa.org/')
  res.send(`
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

  <title>volt.link • Linklist and Redirect Server for Volt Europa</title>
</head>
<body>
<div class="app spine_aligned" dir="auto">
<main class="contentWrapper">
  <h1>Linklist and Redirect Server for Volt Europa</h1>
  <p>
  <!--sse-->Contact: <a href="mailto:thomas.rosen@volteuropa.org">thomas.rosen@volteuropa.org</a><br><!--/sse-->
  <br>
  Example Micropage: <a href="https://volt.link/bonn">volt.link/bonn</a><br>
  Example Redirect: <a href="https://volt.link/🇪🇺">volt.link/🇪🇺</a><br>
  ${
    req.logged_in
    ? ''
    : `
    <br>
    <a href="https://edit.volt.link/">Edit volt.link</a><br>
    <a href="https://volt.link/logout">Logout</a>
    `
  }
  </p>
</main>
</div>
</body>
</html>
`)
})

app.get('/exists/:code', (req, res) => {
  if (!req.logged_in) {
    res.json({ error: 'You are not logged in.' })
  } else {
    let code = req.params.code
    if (!!code && code !== '') {
      code = code.toLowerCase()
      doesFileExist(code, result => res.json({ exists: result }))
    } else {
      res.json({ exists: false })
    }
  }
})

app.get('/quickcheck/:code', (req, res) => {
  if (!req.logged_in) {
    res.json({ error: 'You are not logged in.' })
  } else {
    const response_json = { exists: false, allowed: false }

    const code = (req.params.code || '').toLowerCase()
    const { allowed_to_edit } = quickcheckCode(code, { userEmail: req.user.email })
    response_json.allowed = allowed_to_edit

    doesFileExist(code, exists_result => {
      response_json.exists = exists_result
      res.json(response_json)
    })
  }
})

app.get('/forbidden_codes', (req, res) => {
  if (!req.logged_in) {
    res.json({ error: 'You are not logged in.' })
  } else {
    res.json(forbidden)
  }
})

app.post('/set/:code', (req, res) => {
  if (!req.logged_in) {
    res.json({ error: 'You are not logged in.' })
  } else {
    const code = (req.params.code || '').toLowerCase()
    const { allowed_to_edit } = quickcheckCode(code, { userEmail: req.user.email })

    if (allowed_to_edit) {
      doesFileExist(code, async does_exist => {
        let content = ''

        if (does_exist) {
          try {
            const content_tmp = await getFileContentLocal(code)
            content = content_tmp.toString() || ''
          } catch (error) {
            console.error(error)
          }
        }

        const old_content = yaml.load(content) || {}

        let new_content = req.body

        if (!!new_content) {
          if (hasEditPermission(old_content.permissions || null, req.user.email)) {
            delete new_content.last_modified
            new_content = {
              last_modified: new Date(),
              last_modified_by: req.user.email || '',
              ...new_content,
            }
            new_content = yaml.dump(new_content, {
              indent: 2,
              sortKeys: false,
              lineWidth: -1,
            })

            saveFile(code, new_content)
            .then(async () => {
              res.json({ error: null, saved: true })
              await gitPull()
            })
              .catch(error => res.status(200).json({ error, saved: false }))
          } else {
            res.status(200).json({ error: 'no_edit_permission', saved: false })
          }
        } else {
          res.status(200).json({ error: 'Plase provide a valid content.', saved: false })
        }
      })
    } else {
      res.json({ error: 'Please provide a valid code.', saved: false })
    }
  }
})

app.get('/pull', async (req, res) => {
  if (!req.logged_in) {
    res.json({ error: 'You are not logged in.' })
  } else {
    await gitPull()
    res.json({ done: true })
  }
})

app.get('/rename/:code_old/:code_new', (req, res) => {
  if (!req.logged_in) {
    res.json({ error: 'You are not logged in.' })
  } else {
    const code_old = (req.params.code_old || '').toLowerCase()
    const code_new = (req.params.code_new || '').toLowerCase()
    const { allowed_to_edit: allowed_to_edit_old_code } = quickcheckCode(code_old, { userEmail: req.user.email })
    const { allowed_to_edit: allowed_to_edit_new_code } = quickcheckCode(code_new, { userEmail: req.user.email })

    if (allowed_to_edit_old_code && allowed_to_edit_new_code) {
      doesFileExist(code_new, does_exist => {
        if (!does_exist) {
          getFileContentLocal(code_old)
            .then(content => {
              content = content.toString() || ''
              if (content === '') {
                res.json({ error: 'content_is_empty', saved: false })
              }else{
                content = yaml.load(content)
                if (hasEditPermission(content.permissions, req.user.email)) {
                  delete content.last_modified
                  content = {
                    last_modified: new Date(),
                    last_modified_by: req.user.email || '',
                    ...content,
                  }
                  content = yaml.dump(content, {
                    indent: 2,
                    sortKeys: false,
                    lineWidth: -1,
                  })

                  saveFile(code_new, content)
                    .then(async () => {
                      await removeFile(code_old)
                      await gitPull()
                      res.json({ error: null, saved: true })
                    })
                    .catch(error => res.json({ error: error+'', saved: false }))
                } else {
                  res.json({ error: 'no_edit_permission', saved: false })
                }
              }
            })
            .catch(error => res.json({ error: error+'', saved: false }))
        } else {
          res.json({ error: 'new_code_already_exists', saved: false })
        }
      })
    } else {
      res.json({ error: 'no_edit_permission', saved: false })
    }
  }
})

app.get('/delete/:code', (req, res) => {
  req.logged_in = true
  req.user = { email: 'thomas.rosen@volteuropa.org' }
  if (!req.logged_in) {
    res.json({ error: 'You are not logged in.' })
  } else {
    const code = (req.params.code || '').toLowerCase()

    getFileContentLocal(code)
      .then(async content => {
        content = content.toString() || ''

        let isAllowedToEdit = false
        if (content === '') {
          isAllowedToEdit = true
        } else {
          content = yaml.load(content)
          if (hasEditPermission(content.permissions, req.user.email)) {
            isAllowedToEdit = true
          }
        }

        if (isAllowedToEdit) {
          await removeFile(code)
          await gitPull()
          res.json({ error: null, deleted: true })
        } else {
          res.json({ error: 'no_edit_permission', deleted: false })
        }
      })
      .catch(error => res.json({ error: error + '', deleted: false }))
  }
})

app.get('/get/:code', (req, res) => {
  if (!req.logged_in) {
    res.json({ error: 'You are not logged in.' })
  } else {
    let code = req.params.code
    code = code.toLowerCase()
    getFileContentLocal(code)
      .then(content => {
        const content_parsed = yaml.load(content) || {}

        if (hasEditPermission(content_parsed.permissions, req.user.email)) {
          res.json(content_parsed)
        } else {
          res.status(403).json({ error: 'no_edit_permission' })
        }
      })
      .catch(err => res.status(404).json(err))
  }
})


app.get('/:code', (req, res) => {
  let code = req.params.code
  code = code.toLowerCase()
  getFileContentLocal(code)
    .then((content = '') => {
      // if (!!content) {
        const content_parsed = yaml.load(content) || {}

        let useAs = null
        if (content_parsed.hasOwnProperty('use_as')) {
          useAs = content_parsed.use_as
        }

        const hasUseAs = useAs !== null
        const hasRedirect = !!content_parsed.redirect && content_parsed.redirect !== ''
        const hasLinktree = !!content_parsed.items

        let needsToLogin = false
        if (!req.logged_in) {
          if (
            !!content_parsed.permissions
            && Array.isArray(content_parsed.permissions)
            && content_parsed.permissions.length > 0
          ) {
            needsToLogin = content_parsed.permissions.filter(p => p.role === 'viewer' && p.value === '@volteuropa.org').length > 0
          }
        }

        if (needsToLogin) {
          res.send(renderLoginPage({ code, acceptLanguage: req.headers['accept-language'] }))
        } else {
          if (
            hasRedirect
            && (useAs === 'redirect' || !hasUseAs)
          ) {
            sendInitialStats({
              url: '/' + code,
              website: (process.env.umami_volt_link_id || ''),
              hostname: 'volt.link'
            }, req.headers)
            res.redirect(content_parsed.redirect)
          } else if (
            hasLinktree
            && (useAs === 'linklist' || !hasUseAs)
          ) {
            res.send(renderMicropage({
              ...content_parsed,
              code,
              logged_in: req.logged_in,
              acceptLanguage: req.headers['accept-language'],
            }))
          } else {
            res.status(404).send(renderErrorPage(error))
          }
        }
      // } else {
      //   res.status(404).send(renderErrorPage(error))
      // }
    })
    .catch(error => res.status(404).send(renderErrorPage(error)))
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
