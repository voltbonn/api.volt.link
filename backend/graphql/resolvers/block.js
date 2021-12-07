const { getPermissionsQuery } = require('../functions.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
		if (!args._id) {
			reject('No _id value')
		} else if (!mongodb.ObjectID.isValid(args._id)) {
			reject('_id is not a correct ObjectId')
		} else {
			const blockID = new mongodb.ObjectID(args._id)

      mongodb.collections.blocks.findOne({
	    	_id: blockID,
        ...getPermissionsQuery(context),
	    })
	    .then(resultDoc => {
	    	if (!!resultDoc) {
	    		resolve(resultDoc)
	    	}else{
	    		reject(new Error('Could not find the requested block or no sufficent permission.'))
	    	}
	    })
	    .catch(reject)
		}
	})
}
