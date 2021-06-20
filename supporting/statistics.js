require('dotenv').config({ path: '../.env' })

const path = require('path')
const fs = require('fs')
const yaml = require('js-yaml')

const tree_data_path = path.join('../', (process.env.tree_data_path || ''), 'paths/')

function readFile(path2file) {
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
  if (error) {
    throw error
  }

  files = (
    await Promise.all(
      files
        .filter(file => path.extname(file).toLowerCase() === '.yml')
        .map(filename => readFile(path.join(tree_data_path, filename)))
    )
  )
    .filter(Boolean)
    .map(filecontent => yaml.load(filecontent) || {})

  const use_as = files
    .filter(filecontent => filecontent.hasOwnProperty('use_as'))
    .map(filecontent => filecontent.use_as)

  const stats = {
    redirect: use_as.filter(use_as => use_as === 'redirect').length,
    linklist: use_as.filter(use_as => use_as === 'linklist').length,
    unused: use_as.filter(use_as => use_as === '').length,
    other: use_as.filter(use_as => use_as !== 'redirect' && use_as !== 'linklist' && use_as !== '').length,
  }

  console.log(JSON.stringify(stats, null, 2))
})
