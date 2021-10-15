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
		let ids = args.ids
    .filter(id => mongodb.ObjectID.isValid(id))
    .map(id => new mongodb.ObjectID(id))

    const cursor = mongodb.collections.blocks.find({ _id: { $in: ids } })

    resolve(cursor.toArray())
	})
}
