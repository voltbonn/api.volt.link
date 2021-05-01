require('dotenv').config()

const express = require('express')
const { getFile } = require('./git_functions.js')
const { build } = require('./build_linktree.js')
const yaml = require('js-yaml')

const session = require('express-session')
const FileStore = require('session-file-store')(session)
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy

const app = express()
app.use(express.json())

app.use(express.static('public'))

// START AUTH
async function session_middleware(req, res, next) {

  const origin = req.header('Origin')
  console.log('Origin: ' + origin)

  req.headers['-x-session'] = 's%3A0uji6A1FkMVqsqZP8pK1pKlhKCbWqY6k.LQ0tAfDcbjE%2BtIXl%2FYH6%2Bm%2F99q%2B7cBP962BmTUmwbzs'
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
      const user_profile = {
        id: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
      }
      done(null, user_profile)
    } else {
      done('Wrong Email Domain. You need to be part of Volt Europa.', null)
    }
  }
))

app.use(passport.initialize())
app.use(passport.session())

app.get('/auth/google', passport.authenticate('google', { scope: [
  'https://www.googleapis.com/auth/userinfo.email'
] }))

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  function (req, res) {
    res.redirect('/')
  }
)

app.get('/logout', function (req, res) {
  req.session.cookie.maxAge = 0 // set the maxAge to zero, to delete the cookie
  req.logout()
  res.clearCookie('__session')
  req.session.save(error => { // save the above setting
    if (error) {
      console.error(error)
    } else {
      res.redirect('/') // send the updated cookie to the user and go to the start page
    }
  })
})
// END AUTH
// , cors(corsOptions)
app.get('/user.json', (req, res) => {

  // const origin = req.get('origin')
  const origin = req.header('Origin')
  if (
    typeof origin === 'string'
    && (origin.endsWith('.volt.link') || origin.endsWith('localhost:3000'))
  ) { // allow from subdomains
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', true)
  }

  res.json({ user: req.user })
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
          res.send(build(content_parsed.linktree, { acceptLanguage: req.headers['accept-language'] }))
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
