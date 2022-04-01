const { getPermissionsQuery } = require('../../functions.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
    mongodb.collections.blocks.findOne({
	  	_id: args._id,
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
	})
}
