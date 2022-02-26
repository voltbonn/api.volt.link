const { getPermissionsQuery } = require('./functions.js')

const { parseResolveInfo } = require('graphql-parse-resolve-info')

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

		let isArchivedQueryStage = []
		if (
			args.hasOwnProperty('archived')
			&& typeof args.archived === 'boolean'
  	  && args.archived === true
		) {
  	  isArchivedQueryStage = [{ $match: {
  	    'content.block.properties.archived': { $eq: true }
  	  } }]
  	} else {
  	  isArchivedQueryStage = [{ $match: {
  	    $or: [
  	      { 'content.block.properties.archived': { $exists: false } },
  	      { $and: [
  	        { 'content.block.properties.archived': { $exists: true } },
  	        { 'content.block.properties.archived': false },
  	      ]}
  	    ]
  	  } }]
  	}

		stages = [
			...stages,
			
			{ $unwind: { path: '$content', preserveNullAndEmptyArrays: true } },
      { $lookup: {
      	from: 'blocks',
      	localField: 'content.blockId',
      	foreignField: '_id',
      	as: 'content.block'
     	}},
      { $addFields: { 'content.block': { $first: '$content.block' } } },

			...isArchivedQueryStage,

			// { $match: {
			// 	...getPermissionsQuery(context),
			// }},

			{ $group: {
      	_id: '$_id',
      	block: { $first: '$$ROOT' },
      	content: { $push: '$content' },
      }},
			// { $group: {
      // 	_id: '$_id',
      // 	block: { $first: '$$ROOT' },
      // 	content: {
			// 		$push: {
			// 			$ifNull: [
			// 				'$content',
			// 				{_PRUNE_ME_: '_PRUNE_ME_'}
			// 			]
			// 		}
			// 	},
      // }},
      // { $redact: {
      //   $cond: {
      //   	if: { $eq: [ "$_PRUNE_ME_", '_PRUNE_ME_' ] },
      //   	then: "$$PRUNE",
      //   	else: "$$DESCEND"
      //   }
      // }},
      { $addFields: { 'block.content': '$content' } },
      { $replaceRoot: { newRoot: '$block' } },
		]
	}
	
	return stages
}

module.exports = {
  buildQuery,
}
