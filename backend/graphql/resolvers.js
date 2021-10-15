const { /*GraphQLJSON,*/ GraphQLJSONObject } = require('graphql-type-json')
// const { GraphQLScalarType } = require('graphql')
// const { Kind } = require('graphql/language')

const {
	// GraphQLDate,
	// GraphQLTime,
	GraphQLDateTime,
} = require('graphql-iso-date')

const block = require('./resolvers/block.js')
const blocks = require('./resolvers/blocks.js')
const blockBySlug = require('./resolvers/blockBySlug.js')
const blocksByIds = require('./resolvers/blocksByIds.js')
const blocksByType = require('./resolvers/blocksByType.js')

const saveBlock = require('./mutations/saveBlock.js')

// const { getFilterByKeysFunction, getFilterByLanguageFunction } = require('./functions.js')

module.exports = {
	// JSON: GraphQLJSON,
	JSONObject: GraphQLJSONObject,

	// Timestamp: new GraphQLScalarType({
	// 	name: 'Timestamp',
	// 	description: 'Timestamp custom scalar type',
	// 	parseValue(value) {
	// 		return new Date(value) // value from the client
	// 	},
	// 	serialize(value) {
	// 		return value*1 // .getTime() // value sent to the client
	// 	},
	// 	parseLiteral(ast) {
	// 		if (ast.kind === Kind.INT) {
	// 			return new Date(parseInt(ast.value, 10)) // ast value is always in string format
	// 		}
	// 		return null
	// 	},
	// }),

	// Date: GraphQLDate,
	// Time: GraphQLTime,
	DateTime: GraphQLDateTime,

	// Properties: {
	// 	__resolveType(obj, context, info){
	// 		if (obj.__typename) {
	// 			return obj.__typename
	// 		}
	// 		return 'Error'
	// 	},
	// },

	Query: {
		// hello: (parent, args, context, info) => 'world',

		id: (parent, args, context, info) => (new context.mongodb.ObjectId())+'',
		// whoami: (parent, args, context, info) => (!!context.profileID ? context.profileID+'' : null),

		block,
		blocks,
		// all_subblocks,
		blocksByIds, // (ids: [ID]): [Block]
		blockBySlug,
		blocksByType,
	},
	Mutation: {
		saveBlock,
	},

	Block: {
		// description: getFilterByLanguageFunction('description'),
		// tags: getFilterByKeysFunction('tags'),
	},
}

