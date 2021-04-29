
const { Octokit } = require('@octokit/core')

console.log('process.env.git_secret', process.env.git_secret)

const secret = process.env.git_secret || null
const repoMetadata = {
  owner: 'voltbonn',
  repo: 'tree-data',
}

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
  console.log('branch', branch)
  return octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
    ...repoMetadata,
    branch
  })
}

function getTree(tree_sha) {
  console.log('tree_sha', tree_sha)
  return octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
    ...repoMetadata,
    tree_sha,
  })
}

async function getDataTree() {
  console.log('getDataTree')
  const branch_infos = await getBranch('main')

  if (!!branch_infos) {
    console.log('branch_infos', branch_infos)

    const branch_sha = branch_infos.data.commit.sha
    const tree_main = await getTree(branch_sha)

    let data_tree_sha = tree_main.data.tree.filter(t => t.path === 'data')
    console.log('data_tree_sha', data_tree_sha)

    if (data_tree_sha.length > 0) {
      data_tree_sha = data_tree_sha[0].sha

      const tree_data = await getTree(data_tree_sha)

      return tree_data.data.tree.filter(file => file.path !== '.gitkeep')
    }
  }

  return []
}

async function loadContentBySHA(fileSHA) {
  console.log('loadContentBySHA', fileSHA)
  return octokit.request('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', {
    ...repoMetadata,
    file_sha: fileSHA
  })
}

async function getFile(filename) {
  console.log('getFile', filename)
  const tree = await getDataTree()

  const wanted_file = tree.filter(file => file.path === filename + '.yml')
  console.log('wanted_file', wanted_file)
  if (wanted_file.length > 0) {
    const file = await loadContentBySHA(wanted_file[0].sha)
    return Buffer.from(file.data.content, 'base64').toString('utf-8')
  }

  return null
}

module.exports = {
  getFile
}
