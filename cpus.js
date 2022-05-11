// import OS from 'os'
const OS = require('os')
const UV_THREADPOOL_SIZE = OS.cpus().length || 4
process.stdout.write(String(UV_THREADPOOL_SIZE))
