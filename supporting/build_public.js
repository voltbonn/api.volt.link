const fs = require('fs')
const path = require('path')
const sha256 = require('js-sha256')

function isRegex(pattern) {
  return Object.prototype.toString.call(pattern) === '[object RegExp]'
}

function copyFileSync(source, target, options) {
  const {
    keep_name_regex = null,
    keep_name_array = []
  } = options
  var targetFile = target

  // If target is a directory, a new file with the same name will be created
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source))
    }
  }

  const file_content = fs.readFileSync(source)

  let rel_old = path.relative('dist/', targetFile)
  let rel_new = ''

  let change_file_name = true
  if (keep_name_array.length > 0) {
    change_file_name = !keep_name_array.includes(rel_old)
  }
  if (change_file_name === true && keep_name_regex !== null && isRegex(keep_name_regex)) {
    change_file_name = !keep_name_regex.test(rel_old)
  }

  if (change_file_name) {
    const sha = sha256(file_content).substr(0, 6)

    const {
      dir,
      name: filename,
      ext: extension
    } = path.parse(targetFile)

    const new_target_filepath = `${dir}/${filename}-${sha}${extension}`

    rel_new = path.relative('dist/', new_target_filepath)

    fs.writeFileSync(new_target_filepath, file_content)


  } else {
    fs.writeFileSync(targetFile, file_content)
    rel_new = rel_old
  }

  return {
    new: rel_new,
    old: rel_old
  }
}

function copyFolderRecursiveSync(source, target, options, callback) {
  const {
    rename = false
  } = options
  var files = []

  // Check if folder needs to be created or integrated
  var targetFolder = rename === true ? target : path.join(target, path.basename(source))
  if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder)
  }

  // Copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source)
    files.forEach( function (file) {
      var curSource = path.join(source, file)
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder, false, callback)
      } else {
        const filepath_pair = copyFileSync(curSource, targetFolder, options)
        callback({ filepath_pair })
      }
    })
  }
}

const public_path = './frontend/'
const dist_path = './dist/'

async function build() {
  try {
    await fs.promises.access(dist_path)
    await fs.promises.rmdir(dist_path, { recursive: true, force: true })
  } catch (error) {
    console.error(error)
  }

  await fs.promises.mkdir(dist_path)

  const filepath_pairs = {}
  copyFolderRecursiveSync(public_path, dist_path, {
    rename: true,
    keep_name_array: [
      '.DS_Store',
      'manifest.json',
      'robots.txt',
      'favicon.ico',
      'apple-touch-icon.png',
      'apple-touch-icon-precomposed.png',
    ],
    keep_name_regex: /^volt-logo.*\.png$/g,
  }, ({ filepath_pair }) => {
    filepath_pairs[filepath_pair.old] = filepath_pair.new
  })

}
build()
