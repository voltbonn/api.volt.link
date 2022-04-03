const execShPromise = require('exec-sh').promise

const fs = require('fs')
const yaml = require('js-yaml')
const { Octokit } = require('@octokit/core')
// const { restEndpointMethods } = require('@octokit/plugin-rest-endpoint-methods')
// const crypto = require('crypto')

let tree_data_path = process.env.tree_data_path || ''
if (!tree_data_path.endsWith('/')) {
  tree_data_path = tree_data_path + '/'
}

function getFilePathLocal(code) {
  return tree_data_path + 'paths/' + code + '.yml'
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
  //   debug: console.info,
  //   info: console.info,
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

async function getFileContentLocal(code){
  return new Promise((resolve, reject) => {
    fs.stat(getFilePathLocal(code), (error, stat) => {
      if (error) {
        reject(error)
      }else{
        fs.readFile(getFilePathLocal(code), (error, data) => {
          if (error) {
            reject(error)
          } else {
            resolve(data)
          }
        })
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

async function saveFile(code, content = '') {
  const fileinfo = await getFileInfo(code)
  const prev_sha = fileinfo !== null && typeof fileinfo === 'object' ? fileinfo.sha : null

  return octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
    ...repoMetadata,
    path: `paths/${code}.yml`,
    message: `Changes in ${code}`,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    encoding: 'base64',
    sha: prev_sha
  })
}
async function removeFile(code) {
  const fileinfo = await getFileInfo(code)
  const prev_sha = fileinfo !== null && typeof fileinfo === 'object' ? fileinfo.sha : null

  return new Promise(async resolve => {
    try {
      await octokit.request('DELETE /repos/{owner}/{repo}/contents/{path}', {
        ...repoMetadata,
        path: `paths/${code}.yml`,
        message: `Removed ${code}`,
        sha: prev_sha
      })
    } catch(error) {
      console.error(error)
    }
    resolve(true)
  })
}

function doesFileExist(code, callback) {
  fs.stat(getFilePathLocal(code), (error, stat) => {
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
      await writeCache()
    } catch (error) {
      console.error('Error: ', error)
      console.error('Stderr: ', error.stderr)
      console.error('Stdout: ', error.stdout)
    }
  }
}

async function rebuildCache() {
  return new Promise((resolve, reject) => {
    fs.readdir(tree_data_path + 'paths/', async (error, files) => {
      if (error) {
        reject(error)
      } else {
        files = (
          await Promise.all(
            files.map(filename => new Promise((resolve) => {
              if (!filename.endsWith('.yml')) {
                resolve(false)
              } else {
                fs.readFile(tree_data_path + 'paths/' + filename, (error, content) => {
                  if (error) {
                    resolve(false)
                  } else {
                    content = content.toString() || ''
                    if (content.length > 0) {
                      content = yaml.load(content) || false
                      if (!!content) {
                        filename = filename.substring(0, filename.length - 4)
                        resolve({filename, content})
                      } else {
                        resolve(false)
                      }
                    } else {
                      resolve(false)
                    }
                  }
                })
              }
            }))
          )
        )
        .filter(Boolean)
        .reduce((obj, {filename, content}) => {
          obj[filename] = content
          return obj
        }, {})

        resolve(files)
      }
    })
  })
}

const cacheFolderPath = './cache/'
const cacheFilePath = cacheFolderPath + 'paths.json'

async function writeCache() {
  try {
    await fs.promises.access(cacheFolderPath)
  } catch (error) {
    try {
      await fs.promises.mkdir(cacheFolderPath)
    } catch (error) {
      console.error(error)
    }
  }

  return await fs.promises.writeFile(cacheFilePath, JSON.stringify(await rebuildCache()), 'utf-8')
}

async function readCache() {
  return JSON.parse(await fs.promises.readFile(cacheFilePath, 'utf-8'))
}

function listCommits() {
  return octokit.request('GET /repos/{owner}/{repo}/commits?branch={branch}', {
    ...repoMetadata,
    // sha: repoMetadata.branch,
    path: 'paths',
    per_page: 1, // default is 30, max is 100
  })
}

function getCommit(ref) {
  return octokit.request('GET /repos/{owner}/{repo}/commits/{ref}?branch={branch}', {
    ...repoMetadata,
    ref,
  })
}

function localListCommits() { // { reversed = false }
  // list all commits in a local repo

  // git log --pretty="%H | %s" --max-count=100
  // git log --pretty="%H | %f" --max-count=10 --graph
  // git log --pretty="%H | %s" --max-count=10 --graph

  return new Promise(resolve => {
    // execShPromise(`git log ${reversed === true ? '--reverse' : ''} --pretty="%H" paths/`, {
    execShPromise(`git log --date-order --pretty="%H" paths/`, {
      cwd: tree_data_path,
      stdio: null // "stdio: null" for no output
    })
    .then(result => {
      const commits = result.stdout.split('\n')
      resolve(commits)
    })
    .catch(error => {
      console.error(error)
      process.exit(1)
      resolve([])
    })
  })
}

function parseRawGitFileLine(line) {
  const regex = /^:.+\s([A-Z]+)([0-9]*)\s+([\S]*)(?:\s+([\S]*))?$/
  const matches = regex.exec(line)
  // matches[0] = full match
  // matches[1] = status letter
  // matches[2] = status percent
  // matches[3] = file path
  // matches[4] = new file path

  if (matches !== null) {
    return {
      status_letter: matches[1],
      status_score: (!matches[2] || matches[2] === '') ? null : parseInt(matches[2]), //  The rename or copy score
      filepath: matches[3],
      new_filepath: matches[4] || null, // if renaming or copying
    }
  }

  return null
}

function parseCommitLine(line) {
  const regex = /(.*)\s(.*)\s\[(.*)\]/
  const matches = regex.exec(line)
  // matches[0] = full match
  // matches[1] = commit hash
  // matches[2] = iso-8601 timestamp
  // matches[3] = parent commits separated by spaces

  if (matches !== null) {
    return {
      commitHash: matches[1],
      iso_ts: new Date(matches[2]),
      parents: matches[3].split(' '),
    }
  }

  return null
}

function localListCommitsWithFiles({ max_commits = 1 } = {}) {
  // list all commits in a local repo

  // git log --pretty="%H | %s" --max-count=100
  // git log --pretty="%H | %f" --max-count=10 --graph
  // git log --pretty="%H | %s" --max-count=10 --graph
  // git log --date-order --reverse --max-count=2 --raw --pretty='--separator--%n%H %at %aI [%P]' paths/
  // git log --date-order --reverse --max-count=2 --raw --pretty='--separator--%n%H %aI [%P]' paths/

  return new Promise(resolve => {
    execShPromise(`git log --date-order --reverse --max-count=${max_commits} --raw --pretty='--separator--%n%H %aI [%P]' paths/`, {
      cwd: tree_data_path,
      stdio: null // "stdio: null" for no output
    })
    .then(result => {
      const raw_commits = result.stdout
      .split('--separator--')
      .filter(Boolean)

      let commits = []

      for (let i = 0; i < raw_commits.length; i++) {
        const parsedLines = raw_commits[i]
        .split('\n')
        .filter(Boolean)
        .map(line => {
          if (line.startsWith(':')) {
            return parseRawGitFileLine(line)
          } else {
            return parseCommitLine(line)
          }
        })

        const commit = parsedLines.shift()
        commit.files = parsedLines.filter(Boolean)

        commits.push(commit)
      }

      resolve(commits)
    })
    .catch(error => {
      console.error(error)
      process.exit(1)
      resolve([])
    })
  })
}

function localCheckoutHead() {
  return new Promise((resolve) => {
    execShPromise(`git checkout HEAD`, {
      cwd: tree_data_path,
      stdio: null // "stdio: null" for no output
    })
    .then(result => {
      resolve(true)
    })
    .catch(error => {
      console.error(error)
      resolve(false)
    })
  })
}

function changeLocalRepoToCommit(commitSha) {
  return new Promise(resolve => {
    execShPromise(`git checkout ${commitSha}`, {
      cwd: tree_data_path,
      stdio: null // "stdio: null" for no output
    }).then(() => {
      resolve(true)
    }).catch(error => {
      console.error(error)
      resolve(false)
    })
  })
}

const statusRegex = /([A-Z])([0-9]*)/ // used in localCommitDiffFiles()

function localCommitDiffFiles(commitSha_prev, commitSha_this, { reversed = false }) {
  // return the changed files between two commits
  return new Promise(resolve => {
    let commit_a = commitSha_prev
    let commit_b = commitSha_this
    if (reversed === true) {
      commit_a = commitSha_this
      commit_b = commitSha_prev
    }

    let cmd = `git diff --name-status ${commit_a} ${commit_b} | sed 's/%/%%/g' | while read -r line ; do printf "\${line}\n" ; done | sed 's/\\\ / /g'`

    // Possible status letters are:
    // A: addition of a file
    // C: copy of a file into a new one
    // D: deletion of a file
    // M: modification of the contents or mode of a file
    // R: renaming of a file
    // T: change in the type of the file (regular file, symbolic link or submodule)
    // U: file is unmerged (you must complete the merge before it can be committed)
    // X: "unknown" change type (most probably a bug, please report it)

    execShPromise(cmd, {
      cwd: tree_data_path,
      stdio: null // "stdio: null" for no output
    }).then(result => {
      const stdout = result.stdout.toString()
      const filenames = stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const parts = line.split(/\t/)

        const statusMatch = statusRegex.exec(parts[0])

        const toReturn = {
          status_letter: statusMatch[1],
          status_score: statusMatch[2] === '' ? null : parseInt(statusMatch[2]), //  The rename or copy score
        }

        if (reversed === true) {
          toReturn.filepath = parts[1]
          toReturn.new_filepath = parts[2] || null // if renaming or copying
        } else {
          toReturn.new_filepath = parts[1]
          toReturn.filepath = parts[2] || null // if renaming or copying
        }

        return toReturn
      })

      resolve(filenames)
    }).catch(error => {
      console.error(error)
      process.exit(1)
      resolve([])
    })
  })
}

function localReadFileAtCommit(filepath, commitSha) {
  // return the content of a file at a specific commit
  return new Promise(resolve => {
    execShPromise(`git show "${commitSha}:${filepath}"`, {
      cwd: tree_data_path,
      stdio: null // "stdio: null" for no output
    }).then(result => {
      const stdout = result.stdout.toString()
      resolve(stdout)
    }).catch(error => {
      console.error('Error in localReadFileAtCommit:', error)
      process.exit(1)
      resolve('')
    })
  })
}



module.exports = {
  // getFileContent,
  getFileContentLocal,
  gitPull,
  doesFileExist,
  saveFile,
  removeFile,
  rebuildCache,
  writeCache,
  readCache,

  listCommits,
  getCommit,
  changeLocalRepoToCommit,
  localCommitDiffFiles,
  localReadFileAtCommit,
  localListCommits,
  localCheckoutHead,
  localListCommitsWithFiles,
}
