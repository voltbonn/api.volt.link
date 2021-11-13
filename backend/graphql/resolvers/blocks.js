module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

  // const hasBlockSubQuery = info
  // .operation
  // .selectionSet
  // .selections
  // .find(s => s.name.value === 'blocksByIds')
  // .selectionSet
  // .selections
  // .find(s => s.name.value === 'content')
  // .selectionSet
  // .selections
  // .find(s => s.name.value === 'block')

	return new Promise((resolve,reject)=>{

			const query = {
				// deleted: false,
			}

			if (args._ids && Array.isArray(args._ids) && args._ids.length > 0) {
      	const blockIDs = args._ids
      		.filter(_id => mongodb.ObjectID.isValid(_id))
      		.map(_id => mongodb.ObjectID(_id))

				query._id = { $in: blockIDs }
			}

			if (args.types && Array.isArray(args.types) && args.types.length > 0) {
				const types = args.types.filter(type => typeof type === 'string')
				query.type = { $in: types }
			}

      const cursor = mongodb.collections.blocks.find(query)

    	// const cursor = mongodb.collections.blocks.aggregate([
    	//   {$match: query}
    	// ])

      resolve(cursor.toArray())
	})
}
