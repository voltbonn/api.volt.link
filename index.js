require('dotenv').config()

const {
  getFileContentLocal,
  doesFileExist,
  saveFile,
  gitPull,
} = require('./git_functions.js')
const { build } = require('./build_linklist.js')
const yaml = require('js-yaml')

const express = require('express')
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy

const forbidden_codes = `
auth/google
auth/google/callback
auth/failure
logout
user.json
login
forbidden_codes
pull
exists/
get/
set/
`
.split('\n')
.filter(Boolean)

const admin_addresses = (process.env.admin_addresses || '').split(',')

function hasEditPermission(permissions, userEmail) {
  return (
    typeof userEmail === 'string'
    && userEmail !== ''
    && (
      admin_addresses.includes(userEmail)
      || (
        permissions !== null
        && typeof permissions === 'object'
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
    req.headers['-x-session'] = 's%3A98Wa9FIkoqdguedgRiOa1O_Faexl8eMc.ldykIQLpjQUQjZkgKdlPsZeZltkbnClN8Diq7swf3Hw'
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
    res.redirect(redirect_to || '/')
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
      const redirect_to = req.session.redirect_to + '' // TODO: Why does this need to be converted to a string? To need pass a pointer but the value?
      req.session.redirect_to = null
      res.redirect(redirect_to || '/') // send the updated cookie to the user and go to the start page
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
<script
  async
  defer
  data-website-id="becf9dc6-db9a-42a7-bc64-9637bd885bff"
  src="https://umami.qiekub.org/umami.js"
  data-domains="volt.link"
></script>
</head>
<body>
  <h1>Redirect Server for Volt Europa</h1>
  <!--sse-->Contact: <a href="mailto:thomas.rosen@volteuropa.org">thomas.rosen@volteuropa.org</a></br><!--/sse-->
  Example: <a href="https://volt.link/bonn">volt.link/bonn</a>
</body>
</html>
`)
})

app.get('/exists/:code', (req, res) => {
  if (!req.logged_in) {
    res.status(403).json({ error: 'You are not logged in.' })
  } else {
    if (!!req.params.code && req.params.code !== '') {
      doesFileExist(req.params.code, result => res.json({ exists: result }))
    } else {
      res.status(404).json({ exists: false })
    }
  }
})

app.get('/forbidden_codes', (req, res) => {
  if (!req.logged_in) {
    res.status(403).json({ error: 'You are not logged in.' })
  } else {
    res.json({ codes: forbidden_codes })
  }
})

app.post('/set/:code', (req, res) => {
  if (!req.logged_in) {
    res.status(403).json({ error: 'You are not logged in.' })
  } else {
    if (!!req.params.code && req.params.code !== '') {
    getFileContentLocal(req.params.code)
      .then(content => {
        content = yaml.load(content) || null

        let new_content = req.body

        if (!!new_content) {
          if (hasEditPermission(content.permissions, req.user.email)) {
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

            saveFile(req.params.code, new_content)
            .then(async () => {
              res.json({ error: null, saved: true })
              await gitPull()
            })
              .catch(error => res.status(400).json({ error, saved: false }))
          } else {
            res.status(403).json({ error: 'no_edit_permission', saved: false })
          }
        } else {
          res.status(400).json({ error: 'Plase provide a valid content.', saved: false })
        }
      })
      .catch(err => res.status(400).json(err))

    } else {
      res.status(404).json({ error: 'Please provide a code.', saved: false })
    }
  }
})

app.get('/pull', async (req, res) => {
  if (!req.logged_in) {
    res.status(403).json({ error: 'You are not logged in.' })
  } else {
    await gitPull()
    res.json({ done: true })
  }
})

app.get('/get/:code', (req, res) => {
  if (!req.logged_in) {
    res.status(403).json({ error: 'You are not logged in.' })
  }else{
    getFileContentLocal(req.params.code)
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
  const code = req.params.code
  getFileContentLocal(code)
    .then(content => {
      if (!!content) {
        const content_parsed = yaml.load(content) || {}

        let useAs = null
        if (content_parsed.hasOwnProperty('use_as')) {
          useAs = content_parsed.use_as
        }

        const hasUseAs = useAs !== null
        const hasRedirect = !!content_parsed.redirect && content_parsed.redirect !== ''
        const hasLinktree = !!content_parsed.items

        if (
          hasRedirect
          && (useAs === 'redirect' || !hasUseAs)
        ) {
          res.redirect(content_parsed.redirect)
        } else if (
          hasLinktree
          && (useAs === 'linklist' || !hasUseAs)
        ) {
          res.send(build({code, ...content_parsed}, { acceptLanguage: req.headers['accept-language'] }))
        } else {
          res.redirect('/')
        }
      } else {
        res.redirect('/')
      }
    })
    .catch(err => res.status(404).json(err))
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
