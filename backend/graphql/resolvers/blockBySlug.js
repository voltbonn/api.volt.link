module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
		if (!args.slug || args.slug === '') {
			reject('No slug value')
		} else {
      mongodb.collections.blocks.findOne({
	    	'properties.trigger.type': 'path',
	    	'properties.trigger.path': args.slug,
	    	'properties.action.type': 'render_block',
	    })
	    .then(resultDoc => {
	    	if (!!resultDoc) {
	    		resolve(resultDoc)
	    	}else{
	    		reject(new Error('could not find block by slug.'))
	    	}
	    })
	    .catch(reject)
		}
	})
}
