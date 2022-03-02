const isDevEnvironment = process.env.environment === 'dev' || false
const path = require('path')
const url = require('url')

const { fetch } = require('cross-fetch')
const FileType = require('file-type')

const http = require('http')
const startApolloServer = require('./graphql/expressApolloServer.js')

// const {
//   getTeams,
//   getTeamsSimple,
// } = require('./download_teams.js')

const {
  checkOrigin,
  forbiddenInPath,
} = require('./functions.js')

const { header } = require('./html.js')

const express = require('express')
const RateLimit = require('express-rate-limit')
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy

const sharp = require('sharp')

// function getUserLocales(){
//     const localesByCounty = {
//       de: ['de'],
//     }
//   // https://get.geojs.io/v1/ip/geo/{ip address}.json
// }

const isAbsoluteUrlRegexp = new RegExp('^(?:[a-z]+:)?//', 'i')

const app = express()

// set up rate limiter: maximum of 1000 requests per minute
app.use(new RateLimit({
  windowMs: 1*60*1000, // 1 minute
  max: 1000, // requests per minute
})) // apply rate limiter to all requests

app.use(express.json())

// app.use(express.static('../frontend/'))
app.use(express.static(path.join(__dirname, '../frontend/')))

// START AUTH
async function session_middleware(req, res, next) {

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
      domain: (isDevEnvironment ? 'localhost' : 'volt.link'),
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
  callbackURL: (isDevEnvironment ? 'http://localhost:4004/auth/google/callback' : 'https://api.volt.link/auth/google/callback'),
},
  function (accessToken, refreshToken, profile = {}, done) {
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
        name: profile.name || {},
        email: profile.emails[0].value,
        picture: (profile.photos && profile.photos.length > 0 && profile.photos[0].value ? profile.photos[0].value : ''),
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
  if (!!req.user && !!req.user.id && req.user.id !== null) {
    req.logged_in = true
  } else {
    req.logged_in = false
  }

  // const origin = req.get('origin')
  const origin = req.header('Origin')
  if (checkOrigin(origin)) {
    req.is_subdomain = true
    req.origin = origin
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', true)
  } else {
    req.is_subdomain = false
  }

  next()
})

app.get('/auth/google', function (req, res) {
  passport.authenticate('google', {
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: JSON.stringify({
      redirect_to: req.query.redirect_to || ''
    }),
  })(req, res)
})

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureFlash: false, failureRedirect: '/auth/failure' }),
  function (req, res) {
    let redirect_to = null
    if (req.query.state) {
      const state = JSON.parse(req.query.state)
      redirect_to = state.redirect_to
    }
    res.redirect(typeof redirect_to === 'string' && redirect_to.length > 0 ? redirect_to : '/')
  }
)
app.get('/auth/failure', function (req, res) {
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
      res.send(error)
    } else {
      const redirect_to = req.query.redirect_to
      res.redirect(typeof redirect_to === 'string' && redirect_to.length > 0 ? redirect_to : '/') // send the updated cookie to the user and go to the initally page
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

app.get('/login', (req, res) => {
  res.redirect(url.format({
    pathname: '/auth/google',
    query: req.query,
  }))
})

app.get('/', (req, res) => {
  // res.redirect('https://www.volteuropa.org/')
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  ${header}
  <title>volt.link • Micropage and Redirect Server for Volt Europa</title>
</head>
<body class="basis_0_4">
<div class="app spine_aligned" dir="auto">
<main class="contentWrapper">
  <h1>Microservices for Volt Europa</h1>

  <h3>volt.link</h3>
  <ul>
    ${
      req.logged_in
      ? `<li>Create a micropage/linktree or redirect: <a href="${isDevEnvironment ? 'http://localhost:3000' : 'https://beta.volt.link'}">beta.volt.link</a></li>`
      : `<li>Create a micropage/linktree or redirect: <a href="${isDevEnvironment ? 'http://localhost:4004' : 'https://api.volt.link'}/login?redirect_to=${isDevEnvironment ? 'http%3A%2F%2Flocalhost:3000' : 'https%3A%2F%2Fbeta.volt.link'}">Login and edit volt.link</a></li>`
    }
    <li>All volt.link micropages and redirects: <a href="${isDevEnvironment ? 'http://localhost:4004' : 'https://api.volt.link'}/list">volt.link/list</a></li>
    <li>Contact <!--sse--><a href="mailto:thomas.rosen@volteuropa.org">Thomas Rosen</a><!--/sse--> for help with volt.link.</li>
  </ul>

  <h3>Tools</h3>
  <ul>
    <li>QR-Code Generator: <a href="https://qrcode.volt.link">qrcode.volt.link</a></li>
    <li>Social Media Profile Picture Generator: <a href="https://www.profile-volt.org/">profile-volt.org</a></li>
    <li>All tools Volt uses: <a href="https://volt.link/tools">volt.link/tools</a></li>
  </ul>

  <h3>Other Shortcuts</h3>
  <ul>
    <li>Volt Merch Shops: <a href="https://volt.link/merch">volt.link/merch</a></li>
    <li>Volt related meme pages: <a href="https://volt.link/memes">volt.link/memes</a></li>
  </ul>

  <!--
  <h3>Examples</h3>
  <ul>
    <li>Micropage: <a href="https://volt.link/bonn">volt.link/bonn</a></li>
    <li>Redirect: <a href="https://volt.link/🇪🇺">volt.link/🇪🇺</a></li>
  </ul>
  -->

  <footer>
    <!--sse--><a href="mailto:thomas.rosen@volteuropa.org">Contact</a><!--/sse-->
    ${
      req.logged_in
      ? `&nbsp; • &nbsp;<a href="${isDevEnvironment ? 'http://localhost:4004' : 'https://api.volt.link'}/logout">Logout</a>`
      : `&nbsp; • &nbsp;<a href="${isDevEnvironment ? 'http://localhost:4004' : 'https://api.volt.link'}/login">Login</a>`
    }
    &nbsp; • &nbsp;<a href="https://www.volteuropa.org/legal">Imprint</a>
    &nbsp; • &nbsp;<a href="https://www.volteuropa.org/privacy">Privacy Policy</a>
  </footer>
</main>
</div>
</body>
</html>
`)
})

// app.get('/teams.json', async (req, res) => {
//   if (!req.logged_in) {
//     res.json({ error: 'You are not logged in.' })
//   } else {
//     res.json(await getTeams())
//   }
// })
// app.get('/teams_simple.json', async (req, res) => {
//   if (!req.logged_in) {
//     res.json({ error: 'You are not logged in.' })
//   } else {
//     res.json(await getTeamsSimple())
//   }
// })

app.get('/download_url', async (req, res) => {
  const url = req.query.url || null

  if (typeof url === 'string' && url.length > 0 && isAbsoluteUrlRegexp.test(url)) {
    fetch(url)
      .then(async response => {
        let responseBuffer = await response.buffer()

        const filename = url.split('/').pop() || ''

        let { mime } = await FileType.fromBuffer(responseBuffer) || {}

        if (!mime) {
          if (filename.endsWith('.svg')) {
            mime = 'image/svg'
          } else {
            mime = ''
          }
        }

        if ([
          // sharp support: JPEG, PNG, WebP, AVIF, GIF, SVG, TIFF (date checked: 2022-02-18)
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif', // TODO: sharp does not support animated gifs. Replace with this: https://stackoverflow.com/questions/47138754/nodejs-animated-gif-resizing
          'image/tiff',
        ].includes(mime)) {
          // resize the image in responseBuffer to maxwidth
          const maxWidth = parseInt(req.query.w) || 2000
          const maxHeight = parseInt(req.query.h) || 2000
          let format = req.query.f
          if (![ 'jpeg', 'png', 'webp' ].includes(format)) {
            format = 'jpeg'
          }

          responseBuffer = await sharp(responseBuffer)
            .resize(maxWidth, maxHeight, {
              kernel: sharp.kernel.nearest,
              fit: 'outside',
              withoutEnlargement: true,
              fastShrinkOnLoad: true,
            })
            .toFormat(format)
            .toBuffer()
        }

        res
        .set('Content-Disposition', `filename="${filename}"`)
        .type(mime)
        .status(200)
        .send(responseBuffer)
      })
      .catch(error => {
        console.log(error)
        res.status(404).send(error)
      })
  } else {
    res.status(404).send('')
  }
})

app.get('/forbidden_codes', (req, res) => {
  res.status(200).send(JSON.stringify(forbiddenInPath))
})

const httpServer = http.createServer(app)
startApolloServer(app, httpServer)

const port = 4004
const host = '0.0.0.0' // Uberspace wants 0.0.0.0
httpServer.listen({ port, host }, () =>
  console.info(`
    🚀 Server ready
    View the API at http://${host}:${port}/
    http://${host}:${port}/:code
  `)
)
