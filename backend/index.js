const isDevEnvironment = process.env.environment === 'dev' || false
const path = require('path')
const url = require('url')

const { v4: uuidv4 } = require('uuid')

const { sendInitialStats } = require('./stats.js')

const http = require('http')
const startApolloServer = require('./graphql/expressApolloServer.js')

const {
  getTeam,
  getTeams,
  getTeamsSimple,
} = require('./download_teams.js')

const {
  forbidden,
  quickcheckCode,
  hasEditPermission,
  generateRandomCode,
  checkOrigin,
} = require('./functions.js')

const {
  getFileContentLocal,
  doesFileExist,
  saveFile,
  gitPull,
  removeFile,
  writeCache,
  readCache,
} = require('./git_functions.js')

const { header } = require('./html.js')

const {
  renderErrorPage,
  renderLoginPage,
  renderMicropage,
  renderOverview,
} = require('./render.js')

const yaml = require('js-yaml')

const express = require('express')
const RateLimit = require('express-rate-limit')
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy

// function getUserLocales(){
//     const localesByCounty = {
//       de: ['de'],
//     }
//   // https://get.geojs.io/v1/ip/geo/{ip address}.json
// }

const app = express()

// set up rate limiter: maximum of 100 requests per minute
var limiter = new RateLimit({
  windowMs: 1*60*1000, // 1 minute
  max: 100, // requests per minute
})
app.use(limiter) // apply rate limiter to all requests

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
  callbackURL: (isDevEnvironment ? 'http://localhost:4000/auth/google/callback' : 'https://volt.link/auth/google/callback'),
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

app.get('/user.json', async (req, res) => {
  if (req.logged_in) {
    const editable_links = Object.entries(await readCache() || [])
    .filter(entry => {
      const content = entry[1] || {}
      return hasEditPermission(content.permissions || null, req.user.email, true)
    })
    .map(entry => ({slug: entry[0]}))

    res.json({
      user: {
        ...req.user,
        editable: editable_links,
        logged_in: true,
      },
    })
  } else {
    res.json({
      user: null,
      logged_in: false,
    })
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
      ? `<li>Create a micropage/linktree or redirect: <a href="${isDevEnvironment ? 'http://localhost:3000' : 'https://edit.volt.link'}">edit.volt.link</a></li>`
      : `<li>Create a micropage/linktree or redirect: <a href="${isDevEnvironment ? 'http://localhost:4000' : 'https://volt.link'}/login?redirect_to=${isDevEnvironment ? 'http%3A%2F%2Flocalhost:3000' : 'https%3A%2F%2Fedit.volt.link'}">Login and edit volt.link</a></li>`
    }
    <li>All volt.link micropages and redirects: <a href="${isDevEnvironment ? 'http://localhost:4000' : 'https://volt.link'}/list">volt.link/list</a></li>
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
      ? `&nbsp; • &nbsp;<a href="${isDevEnvironment ? 'http://localhost:4000' : 'https://volt.link'}/logout">Logout</a>`
      : `&nbsp; • &nbsp;<a href="${isDevEnvironment ? 'http://localhost:4000' : 'https://volt.link'}/login">Login</a>`
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
              .catch(error => {
                console.error('error', error)
                res.status(200).json({ error, saved: false })
              })
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

app.post('/set_redirect/', async (req, res) => {
  if (!req.logged_in) {
    res.json({ error: 'You are not logged in.' })
  } else {

    let new_content = req.body

    if (!!new_content && new_content.redirect) {
      const code = await generateRandomCode()

      new_content = {
        ...new_content,
        last_modified: new Date(),
        last_modified_by: req.user.email || '',
        permissions: [{
            _id: uuidv4(),
            value: req.user.email || '',
        }],
      }
      new_content = yaml.dump(new_content, {
        indent: 2,
        sortKeys: false,
        lineWidth: -1,
      })

      saveFile(code, new_content)
        .then(async () => {
          await gitPull()
          res.json({ error: null, saved: true, code: code })
        })
        .catch(error => res.status(200).json({ error, saved: false }))
    } else {
      res.status(200).json({ error: 'please_provide_url', saved: false })
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
app.post('/pull', async (req, res) => {
  if ( // check for github secret
    req
    && req.body
    && req.body.hook
    && req.body.hook.config
    && req.body.hook.config.secret
  ) {
    const gotten_github_webhook_secret = req.body.hook.config.secret || null

    if (
      req.logged_in
      || (
        !!gotten_github_webhook_secret
        && gotten_github_webhook_secret === process.env.github_webhook_secret
      )
    ) {
      await gitPull()
      res.json({ done: true })
    } else {
      res.json({ error: 'You are not logged in.' })
    }
  } else {
    res.json({ error: 'You are not logged in.' })
  }
})
app.get('/writeCache', async (req, res) => {
  res.json( await writeCache() )
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

app.get('/edit/:code', (req, res) => {
  if (typeof req.params.code === 'string' && req.params.code.length > 0) {
    res.redirect(`${isDevEnvironment ? 'http://localhost:4000/' : 'https://edit.volt.link/'}edit/${req.params.code}`)
  } else {
    res.redirect(isDevEnvironment ? 'http://localhost:4000/' : 'https://edit.volt.link/')
  }
})

app.get('/list', async (req, res) => {
  res.redirect('/list/micropages')
})
app.get('/list/:filter', async (req, res) => {
  const userLocalesString = req.query.l || req.headers['accept-language']

  res.send(await renderOverview({
    query: req.query,
    acceptLanguage: userLocalesString,
    filter: req.params.filter,
    logged_in: req.logged_in,
  }))
})
app.get('/featured.json', async (req, res) => {
  const lat = req.query.lat
  const lng = req.query.lng

  const items = Object.entries(await readCache())

  const data = {
    items
  }
  res.json(data)
})
app.get('/teams.json', async (req, res) => {
  if (!req.logged_in) {
    res.json({ error: 'You are not logged in.' })
  } else {
    res.json(await getTeams())
  }
})
app.get('/teams_simple.json', async (req, res) => {
  if (!req.logged_in) {
    res.json({ error: 'You are not logged in.' })
  } else {
    res.json(await getTeamsSimple())
  }
})

app.get('/:code', (req, res) => {
  const userLocalesString = req.query.l || req.headers['accept-language']

  let code = req.params.code
  code = code.toLowerCase()
  getFileContentLocal(code)
    .then(async (content = '') => {
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
          res.send(await renderLoginPage({ code, acceptLanguage: userLocalesString }))
        } else {
          if (
            hasRedirect
            && (useAs === 'redirect' || !hasUseAs)
          ) {
            sendInitialStats({
              url: '/' + code,
              website: (process.env.umami_volt_link_id || ''),
              hostname: (isDevEnvironment ? 'localhost' : 'volt.link'),
            }, req.headers)
            res.redirect(content_parsed.redirect)
          } else if (
            hasLinktree
            && (useAs === 'linklist' || !hasUseAs)
          ) {
            res.send(await renderMicropage({
              ...content_parsed,
              code,
              logged_in: req.logged_in,
              acceptLanguage: userLocalesString,
            }))
          } else {
            res.status(404).send(await renderErrorPage({
              code,
              logged_in: req.logged_in,
              error,
              acceptLanguage: userLocalesString,
            }))
          }
        }
      // } else {
      //   res.status(404).send(await renderErrorPage({
      //     error,
      //     acceptLanguage: userLocalesString,
      //   }))
      // }
    })
    .catch(async error => res.status(404).send(
      await renderErrorPage({
        code,
        logged_in: req.logged_in,
        error,
        acceptLanguage: userLocalesString,
      })
    ))
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

