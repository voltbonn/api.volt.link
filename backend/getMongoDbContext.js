const { MongoClient, ObjectId } = require('mongodb')

const _ContextChache_ = {}

function getMongoDbContext(){
	return new Promise(async (resolve,reject)=>{
		if (_ContextChache_.mongodb) {
			resolve(_ContextChache_.mongodb)
		}else{
			const mongodb_uri = encodeURI(process.env.mongodb_uri) // test?retryWrites=true&w=majority

			if (!mongodb_uri) {
				reject('probably no mongodb rights')
			}else{
				MongoClient.connect(mongodb_uri, {
					useNewUrlParser: true,
					useUnifiedTopology: true,
				}).then(mongodb_client => {
					const names = {
						dbs: {
							graph: 'graph',
						},
						collections: {
							blocks: 'blocks',
						}
					}

					const dbs = {
						graph: mongodb_client.db(names.dbs.graph),
					}
					const collections = {
						blocks: dbs.graph.collection(names.collections.blocks),
					}

					_ContextChache_.mongodb = {
						client: mongodb_client,
						ObjectId,
						ObjectID: ObjectId,

						names,
						dbs,
						collections,
					}

					resolve(_ContextChache_.mongodb)
				}).catch(error=>{
					console.error(error)
					reject('could not connect to mongodb')
				})
			}
		}
	})
}

module.exports = getMongoDbContext
