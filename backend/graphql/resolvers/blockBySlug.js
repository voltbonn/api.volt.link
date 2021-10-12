module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
		if (!args.slug || args.slug === '') {
			reject('No slug value')
		} else {
			const slug = args.slug

      mongodb.collections.blocks.findOne({
	    	'properties.slug': slug,
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
