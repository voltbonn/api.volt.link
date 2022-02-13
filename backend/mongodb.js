const { MongoClient, ObjectId } = require('mongodb')
const mongodb_uri = 'mongodb://127.0.0.1:27017'
const client = new MongoClient(mongodb_uri)

async function connectClient() {
  try {
    await client.connect()
    const database = client.db('data')
    const blocks = database.collection('blocks')
    const history = database.collection('history')

    return {
      client,
      database,
      blocks,
      history,
    }
  } catch (error) {
    console.error(error)
  }
}
async function closeClient() {
  await client.close()
}

// const block_structure = {
//   _id: new ObjectId(),
//   title: '',
//   content: [new ObjectId(), new ObjectId()],
//   parent: new ObjectId(),
// }

async function getBlock(block_id) {
  const { blocks } = await connectClient()
  const block = await blocks.findOne({ _id: ObjectId(block_id) })
  await closeClient()
  return block
}

module.exports = {
  connectClient,
  closeClient,
}
