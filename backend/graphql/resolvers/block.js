const { parseResolveInfo, simplifyParsedResolveInfoFragmentWithType } = require('graphql-parse-resolve-info')

const { getPermissionsQuery } = require('../functions.js')

function simpleFields(fieldsByTypeName) {
	const firstType = Object.keys(fieldsByTypeName)[0]

	if (typeof firstType === 'string') {
		const fields = Object.values(fieldsByTypeName[firstType])
		.reduce((acc, field) => {
			acc[field.name] = {
				// ...field,
				// parentType: firstType,
				// args: field.args,
				fieldsByTypeName: simpleFields(field.fieldsByTypeName),
			}		
			return acc
		}, {})

		return fields
	}

	return {}
}

function buildQuery(parent, args, context, info) {

	let stages = []
	let projectStage = { _id: true }

  const { fieldsByTypeName } = parseResolveInfo(info)
	const fields = simpleFields(fieldsByTypeName) // TODO: check the type (Block, ContentConfig, ...) and only process the fields that are relevant

	projectStage = Object.keys(fields)
		.reduce((acc, field) => {
			acc[field] = true
			return acc
		}, projectStage)
	stages.unshift({ $project: projectStage })

	if (
		fields.hasOwnProperty('content')
		&& fields.content.fieldsByTypeName.hasOwnProperty('block')
	) {
		stages = [
			...stages,
			
			{ $unwind: '$content' },
      { $lookup: {
      	from: 'blocks',
      	localField: 'content.blockId',
      	foreignField: '_id',
      	as: 'content.block'
     	}},
      { $addFields: { 'content.block': { $first: '$content.block' } } },
      { $group: {
      	_id: '$_id',
      	block: { $first: '$$ROOT' },
      	content: { $push: '$content' },
      }},
      { $addFields: { 'block.content': '$content' } },
      { $replaceRoot: { newRoot: '$block' } },
		]
	}
	
	return stages
}

module.exports = async (parent, args, context, info) => {
	const mongodb = context.mongodb

	return new Promise(async (resolve,reject)=>{

		const stages = buildQuery(parent, args, context, info)

		const query = [
			{ $match: {
        ...getPermissionsQuery(context),
				_id: args._id,
      } },

			...stages,
		]

    const cursor = mongodb.collections.blocks.aggregate(query)
    const blocks = await cursor.toArray()

		if (blocks.length === 0) {
			reject(new Error('Could not find the requested block or no sufficent permission.'))
		} else {
			resolve(blocks[0])
		}
	})
}
