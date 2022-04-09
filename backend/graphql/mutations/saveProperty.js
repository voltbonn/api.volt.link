const { getPermissionsAggregationQuery } = require('../../functions.js') // changeParent
const { copyToHistory } = require('../history.js')

module.exports = async (parent, args, context, info) => {
  const mongodb = context.mongodb
  const user = context.user

  if (!context.logged_in) {
    throw new Error('Not logged in.')
  } else {

    const blockId = args._id
    const key = args.key
    const value = args.value

    // TODO: Add "action" if kay is "trigger". See saveBlock.js
    // if (block.properties.hasOwnProperty('trigger')) {
    //   if (
    //     block.properties.trigger.hasOwnProperty('type')
    //     && block.properties.trigger.type === 'path'
    //   ) {
    //     if (!block.properties.hasOwnProperty('action')) {
    //       block.properties.action = {
    //         type: 'render_block',
    //       }
    //     }
    //   }
    // }

    // check if the block exists
    const resultDoc = await mongodb.collections.blocks
      .aggregate([
        { $match: { _id: blockId } },
        ...getPermissionsAggregationQuery(context, ['editor', 'owner']),
      ])

    if (!!resultDoc) {
      const updatePipline = [
        { $set: {
          'metadata.modified_by': user.email,
          'metadata.modified': new Date(),
        } },
      ]

      if (value === null) {
        updatePipline.push({ $unset: { [key]: null } })
      } else {
        updatePipline.push({ $set: { [key]: value } })
      }

      const result = await mongodb.collections.blocks
        .updateOne({ _id: blockId }, updatePipline)

      if (result.matchedCount > 0) {
        await copyToHistory(blockId, mongodb)
        return blockId
      } else {
        throw new Error('Could not save the block.')
      }

    } else {
      console.error('User does not have permission to update the block.')
      throw new Error('You do not have permission to edit this block.')
    }
  }
}
