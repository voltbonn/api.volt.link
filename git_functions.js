require('dotenv').config()

const execShPromise = require('exec-sh').promise

const fs = require('fs')
const { Octokit } = require('@octokit/core')
// const { restEndpointMethods } = require('@octokit/plugin-rest-endpoint-methods')
// const crypto = require('crypto')

let tree_data_path = process.env.tree_data_path
if (!tree_data_path.endsWith('/')) {
  tree_data_path = tree_data_path + '/'
}

function getFilePathLocal (filename) {
  return tree_data_path + 'paths/' + filename + '.yml'
}

const secret = process.env.git_secret || null
const repoMetadata = {
  owner: 'voltbonn',
  repo: 'data-for-volt.link',
  branch: 'main',
}
const folder_name_paths = 'paths'

// const OctokitWithRest = Octokit.plugin(restEndpointMethods)
const OctokitWithRest = Octokit
const octokit = new OctokitWithRest({
  auth: secret,
  userAgent: 'volt.link',
  // previews: ['thomasrosen'],
  timeZone: 'Europe/Berlin',
  baseUrl: 'https://api.github.com',
  // log: {
  //   debug: console.log,
  //   info: console.log,
  //   warn: console.warn,
  //   error: console.error
  // },
  // request: {
  //   agent: undefined,
  //   fetch: undefined,
  //   timeout: 0
  // }
})

function getBranch(branch) {
  return octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
    ...repoMetadata,
    branch
  })
}

function getTree(tree_sha) {
  return octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
    ...repoMetadata,
    tree_sha,
  })
}

async function getPathsTree() {
  const branch_infos = await getBranch('main')

  if (!!branch_infos) {
    const branch_sha = branch_infos.data.commit.sha
    const tree_main = await getTree(branch_sha)

    let paths_tree_sha = tree_main.data.tree.filter(t => t.path === folder_name_paths)

    if (paths_tree_sha.length > 0) {
      paths_tree_sha = paths_tree_sha[0].sha

      const tree_paths = await getTree(paths_tree_sha)

      return tree_paths.data.tree.filter(file => file.path !== '.gitkeep')
    }
  }

  return []
}

// function loadContentBySHA(fileSHA) {
//   return octokit.request('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', {
//     ...repoMetadata,
//     file_sha: fileSHA
//   })
// }

async function getFileInfo (filename) {
  filename = filename.toLowerCase()

  const tree = await getPathsTree()

  const wanted_file = tree.filter(file => file.path === filename + '.yml')
  if (wanted_file.length > 0) {
    return wanted_file[0]
  }

  return null
}

// async function getFileContent(filename) {
//   filename = filename.toLowerCase()
//   const file = await octokit.rest.repos.getContent({
//     ...repoMetadata,
//     path: `paths/${filename}.yml`,
//   })
//   return Buffer.from(file.data.content, file.data.encoding).toString('utf-8')
// }

async function getFileContentLocal(filename){
  return new Promise((resolve, reject) => {
    fs.stat(getFilePathLocal(filename), (error, stat) => {
      if (error === null) {
        fs.readFile(getFilePathLocal(filename), (error, data) => {
          if (error) {
            reject(error)
          } else {
            resolve(data)
          }
        })
      } else {
        reject(error)
      }
    })
  })
}

// // Source of getOid(): https://dev.to/ethanarrowood/building-git-with-node-js-and-typescript-part-1-1d94
// function getOid(type, str) {
//   // Function to create git object ids
//   // str needs to be a Buffer
//   // type needs to be a string. Eg.: "blob"
//
//   // create a buffer from the type, binary string length, and a null byte
//   const header = Buffer.from(`${type} ${str.length}\0`)
//   // create the hash content by concatenating the header and the binary string
//   const content = Buffer.concat([header, str], header.length + str.length)
//   // create a hash generator using the 'sha1' algorithm
//   const shasum = crypto.createHash('sha1')
//   // update the hash generator with the content and use a hexadecimal digest to create the object id
//   const oid = shasum.update(content).digest('hex')
//
//   return oid
// }

async function saveFile(filename, content = '') {
  const fileinfo = await getFileInfo(filename)
  const prev_sha = fileinfo !== null && typeof fileinfo === 'object' ? fileinfo.sha : null

  return octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
    ...repoMetadata,
    path: `paths/${filename}.yml`,
    message: 'Automatic update',
    content: Buffer.from(content, 'utf-8').toString('base64'),
    encoding: 'base64',
    sha: prev_sha
  })
}

function doesFileExist(filename, callback) {
  fs.stat(getFilePathLocal(filename), (error, stat) => {
    if (error === null) {
      callback(true)
    } else if (error.code === 'ENOENT') {
      callback(false)
    }
  })
}

async function gitPull() {
  if (!!tree_data_path) {
    try {
      await execShPromise('git pull --no-rebase', {
        cwd: tree_data_path,
        stdio: null // "stdio: null" for no output
      })
    } catch (error) {
      console.error('Error: ', error)
      console.error('Stderr: ', error.stderr)
      console.error('Stdout: ', error.stdout)
    }
  }
}

module.exports = {
  getFileContent,
  getFileContentLocal,
  gitPull,
  doesFileExist,
  saveFile,
}
