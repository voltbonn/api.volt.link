const { getPermissionsQuery } = require('../functions.js')

module.exports = (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
		if (!context.logged_in) {
			reject('Not logged in.')
		} else if (!mongodb.ObjectId.isValid(args._id)) {
			reject('_id is not a valid mongoDB id.')
		} else {
			const _id = new mongodb.ObjectId(args._id)

			mongodb.collections.blocks.deleteOne(
				{
					_id,
					...getPermissionsQuery(context, ['editor', 'owner']),
				},
			)
			.then(result => {
				if (result.acknowledged === true) {
					if (result.deletedCount > 0) {
						resolve(true)
					} else {
						resolve(false)
					}
				} else {
					reject('Probably no permissions to delete the block.')
				}
			})
			.catch(reject)
    }
	})
}
