const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const _cypher_algorithm_ = 'chacha20-poly1305' // 'aes-256-ctr'

function encryptText(text, secretKey) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(_cypher_algorithm_, secretKey, iv, {
    authTagLength: 16
  })
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])

  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}
function decryptText(hash, secretKey) {
  let [iv, encrypted_content] = hash.split(':')
  iv = Buffer.from(iv, 'hex')
  encrypted_content = Buffer.from(encrypted_content, 'hex')

  const decipher = crypto.createDecipheriv(_cypher_algorithm_, secretKey, iv, {
    authTagLength: 16
  })
  const decrpyted = Buffer.concat([decipher.update(encrypted_content), decipher.final()])
  return decrpyted.toString()
}
function encryptObject(obj, privateKeyHex) {
  const privateKey = Buffer.from(privateKeyHex, 'hex')
  const json = JSON.stringify(obj)
  const encryptedText = encryptText(json, privateKey)
  return encryptedText
}
function decryptObject(encryptedText, privateKeyHex) {
  const privateKey = Buffer.from(privateKeyHex, 'hex')
  const decryptedText = decryptText(encryptedText, privateKey)
  const obj = JSON.parse(decryptedText)
  return obj
}

export async function signJwtPromise(payload, secret) {
  return new Promise((resolve, reject) => {
    jwt.sign(payload, secret, {
      algorithm: 'HS256',
      noTimestamp: true,
    }, function (error, token) {
      if (error) {
        console.error(error)
        reject(error)
      } else {
        console.log(token)
        resolve(token)
      }
    })
  })
}
export async function verifyJwtPromise(token, secret) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, {
      algorithms: ['HS256'],
      // audience: 'urn:foo',
      // issuer: 'https://volt.link',
      // jwtid: 'jwtid',
      // subject: 'subject',
    }, function (error, decoded) {
      if (error) {
        console.error(error)
        reject(error)
      } else {
        resolve(decoded)
      }
    })
  })
}

export async function getApiKey() {
  const newApiKeyProperties = {}

  let newApiKey = null
  let newApiKeySecret = null
  let newAccessToken = null

  try {
    newApiKey = crypto.randomUUID()
    newApiKeySecret = crypto.randomBytes(32).toString('hex')

    const now = new Date().getTime()
    const one_year = 31556952000 // in milliseconds

    // const userInfo = {}
    // const userId = String(user._id || '')
    // const userEmail = String(user.email || '')
    // if (userId.length > 0 || userEmail.length > 0) {
    //   if (userId.length > 0) {
    //     userInfo.blockId = userId
    //   }
    //   if (userEmail.length > 0) {
    //     userInfo.email = userEmail
    //   }
    // }

    const payload = {
      iss: 'https://volt.link',
      // aud: 'https://volt.link', // TODO: i think this is not the correct use of audience
      iat: now - one_year, // when the token was issued/created (now)
      // nbf: now - one_year, // a timestamp when the token starts being valid // TODO: define this in block.properties
      // exp: now + one_year, // a timestamp when the token expires // TODO: define this in block.properties

      type: 'apikey', // 'session' (session would use the default session-secret)
      jti: newApiKey, // a unique identifier for the token (is needed to decryt volt_api_options)
      // user: encryptObject(userInfo, newApiKeySecret),

      // scope: 'email profile phone address',
      // roles: [],
      // at_use_nbr: 0, // Number of API requests for which the access token can be used
      // azp: encryptObject({ // Authorized party - the party to which the ID Token was issued
      // 	blockId: user._id,
      // 	email: user.email,
      // }, newApiKeySecret),
    }

    newAccessToken = await signJwtPromise(payload, newApiKeySecret)
  } catch (error) {
    console.error(error)
  }

  newApiKeyProperties.apikey = newApiKey
  newApiKeyProperties.apiKeySecret = newApiKeySecret
  newApiKeyProperties.accessToken = newAccessToken

  // try {
  //   newApiKeyProperties.decodedToken = await verifyJwtPromise(newAccessToken, newApiKeySecret)
  // } catch (error) {
  //   console.error(error)
  // }
  // if (!!newApiKeyProperties.decodedToken) {
  //   newApiKeyProperties.decodedUser = await decryptObject(newApiKeyProperties.decodedToken.user, newApiKeySecret)
  // }

  return newApiKeyProperties
}
