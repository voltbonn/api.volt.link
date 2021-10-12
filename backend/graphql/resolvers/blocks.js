module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
		if (!args._ids) {
			reject('No _id value')
		} else if (!Array.isArray(args._ids)) {
			reject('_ids needs to be an array')
		} else {
      const blockIDs = args._ids
      .filter(_id => mongodb.ObjectID.isValid(_id))
      .map(_id => mongodb.ObjectID(_id))

      const cursor = mongodb.collections.blocks.find({
	    	// _id: new mongodb.ObjectID("6140656fd943b7a3d35343ee") // blockIDs,
	    	_id: { $in: blockIDs },
	    })

      resolve(cursor.toArray())
		}
	})
}
