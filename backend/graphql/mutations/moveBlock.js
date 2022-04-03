const { changeParent } = require('../../functions.js')

module.exports = async (parent, args, context, info) => {
	if (!context.logged_in) {
		throw new Error('Not logged in.')
	} else {
		const movingBlockId = args.movingBlockId
		const newParentId = args.newParentId
		const newPositionInContent = args.newIndex

    return await changeParent(context, newParentId, movingBlockId, newPositionInContent)
	}
}
