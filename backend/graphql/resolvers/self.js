const { getPermissionsAggregationQuery } = require('../../functions.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise(async (resolve,reject)=>{
    if (context.logged_in) {

      let userroles = new Set()
      const user_email = ((context || {}).user || {}).email || null
      const admin_addresses = (process.env.admin_addresses || '').split(',').filter(Boolean)
      if (
        typeof user_email === 'string'
        && admin_addresses.length > 0
        && admin_addresses.includes(user_email)
      ) {
        userroles.add('admin')
      }
      userroles = [...userroles]

      // get the user block
      const cursor = mongodb.collections.blocks.aggregate([
        {$match: {
	    	  type: 'person',
        }},
        
        ...getPermissionsAggregationQuery(context, ['owner'], { noAdminCheck: true }),
      ])

      let blocks = await cursor.toArray()

      if (blocks.length > 0) {
        const resultDoc = blocks[0]

        resolve({
          user: context.user,
          logged_in: true,
          blockId: resultDoc._id,
          userroles: [...userroles],
        })
	    } else {

        const properties = {}

        const username = context.user.email.split('@')[0]
        const displayName = context.user.displayName || username

        properties.slug = username
        properties.text = displayName
        // properties.text = [
        //   { value: displayName, locale: context.locale },
        // ]

        if (context.user.picture.length > 0 && !context.user.picture.includes('default-user')) {
          properties.icon = context.user.picture
        }

        // create user block if it doesn't exist
				mongodb.collections.blocks.insertOne({
          type: 'person',
          content: [],
          properties,
          permissions: {
            '/': [
              { email: context.user.email, role: 'owner' },
            ],
          },
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
              userroles: [],
            })
					} else {
						reject('Could not create the user-block.')
					}
				})
				.catch(reject)
	    }
    } else {
      resolve({
        user: null,
        logged_in: false,
        blockId: null,
        userroles: [],
      })
    }
	})
}
