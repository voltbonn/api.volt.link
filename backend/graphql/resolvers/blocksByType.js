module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
		if (!args.type) {
			reject('No type')
		} else if (typeof args.type !== 'string') {
			reject('type needs to be a string')
		} else {
      const cursor = mongodb.collections.blocks.find({ type: args.type })
      resolve(cursor.toArray())
		}
	})
}
