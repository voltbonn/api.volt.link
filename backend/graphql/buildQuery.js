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
		if (args.hasOwnProperty('archived')) {
			if (
				typeof args.archived === 'boolean'
  		  && args.archived === true
			) {
  		  isArchivedQueryStage = [{ $match: {
  		    'block.properties.archived': { $eq: true }
  		  } }]
  		} else {
  		  isArchivedQueryStage = [{ $match: {
  		    $or: [
  		      { 'block.properties.archived': { $exists: false } },
  		      { $and: [
  		        { 'block.properties.archived': { $exists: true } },
  		        { 'block.properties.archived': false },
  		      ]}
  		    ]
  		  } }]
  		}
		}

		stages = [
			...stages,
			
  		{ $facet: {
      	newBlock: [], // An empty array copies the currently matched docs.
      	newContent: [
					{ $unwind: { path: '$content' } },
      		{ $lookup: {
      			from: 'blocks',
      			localField: 'content.blockId',
      			foreignField: '_id',
      			as: 'content.block'
     			}},
      		{ $addFields: { 'content.block': { $first: '$content.block' } } },
  				{ $replaceRoot: { newRoot:  '$content' } },
  				{ $match: {
						'block._id': { $ne: null },
						...getPermissionsQuery(context, null, { fieldName: 'block.permissions' }),
					}},

					...isArchivedQueryStage,
      	]
  		}},
  
	  	{ $addFields: { 'newBlock': { $first: '$newBlock' } } },
	  	{ $addFields: { 'newBlock.content': '$newContent' } },
	  	{ $replaceRoot: { newRoot: '$newBlock' } },
		]
	}
	
	return stages
}

module.exports = {
  buildQuery,
}
