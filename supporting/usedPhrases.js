require('dotenv').config({ path: '../.env' })

const {
  getFileContentLocal,
  getPathsTree,
} = require('../git_functions.js')
// getFileContentLocal

const path = require('path')
const fs = require('fs')
const yaml = require('js-yaml')

const tree_data_path = path.join('../', (process.env.tree_data_path || ''), 'paths/')

function readFile(path2file){
  return new Promise((resolve, reject) => {
    fs.readFile(path2file, (error, data) => {
      if (error) {
        console.error(error)
        resolve(null)
      } else {
        resolve(data)
      }
    })
  })
}

fs.readdir(tree_data_path, async function (error, files) {
  files = (
    await Promise.all(
      files
      .filter(file => path.extname(file).toLowerCase() === '.yml')
      .map(filename => readFile(path.join(tree_data_path, filename)))
    )
  )
    .filter(Boolean)
    .map(filecontent => yaml.load(filecontent) || {})
    .filter(filecontent => filecontent.hasOwnProperty('items') && filecontent.items.length > 0)
    .flatMap(filecontent => filecontent.items.flatMap(item => [item.title || null, item.text || null]))
    .filter(translations => !!translations && translations.length > 0)
    .map(translations => translations
      .filter(translation => translation.value.length > 0 && translation.value.length < 50)
      .map(translation => {
        delete translation._id
        return translation
      })
    )
    .filter(translations => !!translations && translations.length > 0)

  const values = files
    .reduce((obj, translations) => {
      for (const translation of translations) {
        const thisLocale = translation.locale
        const thisValue = translation.value
        if (!obj.hasOwnProperty(thisLocale)) {
          obj[thisLocale] = {}
        }
        if (!obj[thisLocale].hasOwnProperty(thisValue)) {
          obj[thisLocale][thisValue] = {}
        }
        for (const translation of translations) {
          obj[thisLocale][thisValue][translation.locale] = translation.value
        }
      }
      return obj
    }, {})

  let counted = files
    .reduce((obj, translations) => {
      for (const translation of translations) {
        if (
          translation.locale === 'de'
        ) {
          const thisValue = translation.value
          // const thisLocale = translation.locale
          // if (!obj.hasOwnProperty(thisLocale)) {
          //   obj[thisLocale] = {}
          // }
          // if (!obj[thisLocale].hasOwnProperty(thisValue)) {
          //   obj[thisLocale][thisValue] = 0
          // }
          // obj[thisLocale][thisValue] += translations.length

          if (!obj.hasOwnProperty(thisValue)) {
            obj[thisValue] = 0
          }
          obj[thisValue] += translations.length
        }
      }
      return obj
    }, {})
  counted = Object.entries(counted)
  .filter(entry => entry[1] > 1)
  .sort((a, b) => b[1] - a[1])
  .map(entry => entry[0])

  // files = Object.values(files)
  // .map(translations => [...translations].map(translation => JSON.parse(translation)))

  // console.log(counted)
  console.log(counted.join('\n'))
})


// async function getFileInfo() {
//   const tree = await getPathsTree()

//   console.log('tree', tree)

//   return null
// }
// getFileInfo()
