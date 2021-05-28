require('dotenv').config()

const https = require('https')
const { acceptedLanguages } = require('@fluent/langneg')

function trackPageview(payload, headers) {
  const data = JSON.stringify({
    payload: {
      website: '', // 'your-website-id',
      url: '/',
      referrer: '',
      hostname: '', // 'your-hostname',
      language: '', // 'en-US',
      screen: '', // '1920x1080',
      ...payload,
    },
    type: 'pageview'
  })

  const req = https.request({
    hostname: 'umami.qiekub.org',
    port: 443,
    path: '/api/collect',
    method: 'POST',
    headers: {
      'User-Agent': headers['user-agent'] || '',
      'Accept-Language': headers['accept-language'] || '',
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    }
  }, null)
  req.on('error', error => console.error(error))
  req.write(data)
  req.end()
}

function trackEvent(payload, headers) {
  const data = JSON.stringify({
    payload: {
      website: '', // 'your-website-id',
      url: '/',
      event_type: 'custom', // 'click',
      event_value: '', // 'signup-button',
      hostname: '', // 'your-hostname',
      language: '', // 'en-US',
      screen: '', // '1920x1080',
      ...payload,
    },
    type: 'event'
  })

  const req = https.request({
    hostname: 'umami.qiekub.org',
    port: 443,
    path: '/api/collect',
    method: 'POST',
    headers: {
      'User-Agent': headers['user-agent'] || '',
      'Accept-Language': headers['accept-language'] || '',
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    }
  }, null)
  req.on('error', error => console.error(error))
  req.write(data)
  req.end()
}

function sendInitialStats({
  website = '',
  url = '/',
  hostname = ''
}, headers = {}) {
  const userLocales = acceptedLanguages(headers['accept-language'] || '')

  if (!!userLocales || Array.isArray(userLocales)) {
    const defaultPayload = {
      website,
      url,
      hostname,
      language: userLocales.length > 0 ? userLocales[0] : '',
    }

    trackPageview(defaultPayload, headers)

    for (let locale of userLocales) {
      locale = locale.toLowerCase() // Not really correct but the system locales sadly don't conform to the standard.

      const language = locale.split('-')[0]
      if (language !== locale) {
        trackEvent({
          ...defaultPayload,
          event_value: `L: ${language}`, // Log just the language.
        }, headers)
      }
      trackEvent({
        ...defaultPayload,
        event_value: `L: ${locale}`, // Log the full locale.
      }, headers)
    }
  }
}

module.exports = {
  sendInitialStats,
}
