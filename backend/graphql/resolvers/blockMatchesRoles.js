const { getPermissionsQuery } = require('../functions.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
		if (!mongodb.ObjectID.isValid(args._id)) {
			reject('_id is not a correct ObjectId')
		} else {
			const blockID = new mongodb.ObjectID(args._id)

      mongodb.collections.blocks.findOne({
	    	_id: blockID,
        ...getPermissionsQuery(context, args.roles),
	    })
	    .then(resultDoc => {
	    	if (!!resultDoc) {
	    		resolve(true)
	    	}else{
	    		resolve(false)
	    	}
	    })
	    .catch(reject)
		}
	})
}
