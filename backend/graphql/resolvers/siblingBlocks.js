const { getPermissionsQuery, getRolesOfUser } = require('../functions.js')

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise(async resolve => {
		const finalQuery = {
			...getPermissionsQuery(context),
		}

		if (Array.isArray(args.types) && args.types.length > 0) {
			finalQuery.type = { $in: args.types }
		}

    const cursor = mongodb.collections.blocks.aggregate([
			{ $match: {
				_id: args._id,
				...getPermissionsQuery(context),
			} },

			{ $lookup: {
			  from: 'blocks',
			  localField: '_id',
			  foreignField: 'content.blockId',
			  as: 'parents',
			}},

			{ $unwind: '$parents' },
			{ $unwind: '$parents.content' },
			{ $replaceRoot: { newRoot: '$parents.content' } },

			{ $lookup: {
			  from: 'blocks',
			  localField: 'blockId',
			  foreignField: '_id',
			  as: 'siblings',
			}},

			{ $unwind : '$siblings' },
			{ $replaceRoot: { newRoot: '$siblings' } },
			{ $match: finalQuery },
    ])

		let blocks = await cursor.toArray()

		if (context.logged_in === true) {
			blocks = blocks.map(block => {
				if (!block.computed) {
					block.computed = {}
				}
				block.computed.roles = getRolesOfUser(context, block.permissions)
				return block
			})
		} else {
			// Remove permission infos from the blocks if not logged-in, to not leak user data.
			blocks = blocks.map(block => {
				if (!block.computed) {
					block.computed = {}
				}
				block.computed.roles = ['viewer'] // getRolesOfUser doesn't make sense here, as we don't have a user.
				delete block.permissions
				return block
			})
		}

    resolve(blocks)
	})
}
