
const { Octokit } = require('@octokit/core')

const secret = process.env.git_secret || null
const repoMetadata = {
  owner: 'voltbonn',
  repo: 'tree-data',
}
const folder_name_paths = 'paths'

const octokit = new Octokit({
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

function loadContentBySHA(fileSHA) {
  return octokit.request('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', {
    ...repoMetadata,
    file_sha: fileSHA
  })
}

async function getFile(filename) {
  filename = filename.toLowerCase()

  const tree = await getPathsTree()

  const wanted_file = tree.filter(file => file.path === filename + '.yml')
  if (wanted_file.length > 0) {
    const file = await loadContentBySHA(wanted_file[0].sha)
    return Buffer.from(file.data.content, 'base64').toString('utf-8')
  }

  return null
}

module.exports = {
  getFile
}
