// https://projectfluent.org/play/
const path = require('path')
const { promises: fsp } = require('fs')

const { FluentBundle, FluentResource } = require('@fluent/bundle')
const { negotiateLanguages, acceptedLanguages } = require('@fluent/langneg')

const locales = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  it: 'Italiano',
  nl: 'Nederlands', // Dutch
  da: 'Dansk', // Danish
  sv: 'Svenska', // Swedish
  nb: 'Norsk bokmål', // Norwegian
  fi: 'Suomi', // Finish
  mt: 'Malti', // Maltese
  // pl: 'Język polski', // Polish
  ru: 'русский язык', // Russian
  // bg: 'български език', // Bulgarian
  tr: 'Türkçe',
  ar: 'اَلْعَرَبِيَّة', // Arabic
  // el: 'ελληνικά', // Greek
  // ro: 'limba română', // Romanian
  // sl: 'slovenščina', // Slovenian
  // uk: 'украї́нська мо́ва', // Ukrainian
  // cy: 'Cymraeg', // Welsh
}

const _supportedLocales_ = Object.keys(locales)
const _defaultLocale_ = 'en'




async function fetchMessagesServer(locale) {
  const filepath = path.join(__dirname, '../locales/' + locale + '.ftl')
  const messages = await fsp.readFile(filepath, 'utf-8')
  return { [locale]: new FluentResource(messages) }
}

async function fetchMessagesClient(locale) {
  const path = await import('../locales/' + locale + '.ftl')

  const response = await fetch(path.default)
  const messages = await response.text()

  return { [locale]: new FluentResource(messages) }
}

async function fetchMessages(locale) {
  return await fetchMessagesServer(locale)
  // return await fetchMessagesClient(locale)
}

// function getDefaultBundles() {
//   const bundle = new FluentBundle('')
//   bundle.addResource(new FluentResource(''))
//   return new ReactLocalization([bundle])
// }

async function createMessagesGenerator(currentLocales) {
  const fetched = await Promise.all(
    currentLocales.map(fetchMessages)
  )

  const messages = fetched.reduce(
    (obj, cur) => Object.assign(obj, cur)
  )

  return function* generateBundles() {
    for (const locale of currentLocales) {
      const bundle = new FluentBundle(locale)
      let errors = bundle.addResource(messages[locale])
      if (errors.length) {
        console.error(errors)
      }
      yield bundle
    }
  }
}

async function loadFluentBundles({ acceptLanguage }) {
  const userLocales = acceptedLanguages(acceptLanguage)

  const currentLocales = negotiateLanguages(
    userLocales,
    _supportedLocales_,
    { defaultLocale: _defaultLocale_ }
  )

  return await createMessagesGenerator(currentLocales) // returns a generator function
}


function getMessage_inner(bundles, id, properties) {
  const bundle = bundles.next()
  if (!bundle.value || bundle.done === true) {
    return null
  } else {
    let message = bundle.value.getMessage(id)
    if (message) {
      return bundle.value.formatPattern(message.value, properties)
    } else {
      return getMessage_inner(bundles, id, properties)
    }
  }
}
function getMessage(bundles, ...attr) {
  return getMessage_inner(bundles(), ...attr)
}

module.exports = {
  locales,
  loadFluentBundles,
  getMessage,
}

/*

loadFluentBundles({ acceptLanguage: 'en,de' })
.then(bundles => {
  let msg = getMessage(bundles, 'test')
  console.info(msg)
})
.catch(error => console.error(error))

*/
