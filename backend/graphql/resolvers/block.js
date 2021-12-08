const { getPermissionsQuery } = require('../functions.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
    mongodb.collections.blocks.findOne({
	  	_id: args._id,
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
	})
}
