const { getPermissionsQuery } = require('../functions.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise((resolve,reject)=>{
    if (context.logged_in) {
      // get the user block
      mongodb.collections.blocks.findOne({
	    	type: 'person',
        ...getPermissionsQuery(context, ['owner']),
	    })
	    .then(resultDoc => {
	    	if (!!resultDoc) {
          resolve({
            user: context.user,
            logged_in: true,
            blockId: resultDoc._id,
          })

	    		resolve(resultDoc)
	    	} else {

          const properties = {}

          const displayName = context.user.displayName
          if (displayName.length > 0) {
            properties.trigger = {
              type: 'path',
              path: displayName.toLowerCase().replace(/\s/g, '.'),
            }
            properties.action = {
              type: 'render_block',
            }
            properties.text = [
              { value: context.user.displayName || '', locale: context.locale },
            ]
          }

          if (context.user.picture.length > 0) {
            properties.icon = context.user.picture
          }

          // create user block if it doesn't exist
					mongodb.collections.blocks.insertOne({
            type: 'person',
            content: [],
            properties,
            permissions: [
              { email: context.user.email, role: 'owner' },
            ],
            metadata: {
              created: new Date(),
              modified: new Date(),
            },
          })
					.then(result => {
						if (result.insertedId) {
              resolve({
                user: context.user,
                logged_in: true,
                blockId: result.insertedId,
              })
						} else {
							reject('Could not create the user-block.')
						}
					})
					.catch(reject)
	    	}
	    })
	    .catch(reject)
    } else {
      resolve({
        user: null,
        logged_in: false,
        blockId: null,
      })
    }
	})
}
