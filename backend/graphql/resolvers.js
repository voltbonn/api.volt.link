const { /*GraphQLJSON,*/ GraphQLJSONObject } = require('graphql-type-json')
// const { GraphQLScalarType } = require('graphql')
// const { Kind } = require('graphql/language')

const {
	// GraphQLDate,
	// GraphQLTime,
	GraphQLDateTime,
} = require('graphql-iso-date')

const GraphQLUpload = require('graphql-upload/GraphQLUpload.js')

const block = require('./resolvers/block.js')
const blocks = require('./resolvers/blocks.js')
const blockBySlug = require('./resolvers/blockBySlug.js')
const blocksBySlugs = require('./resolvers/blocksBySlugs.js')
const parentBlocks = require('./resolvers/parentBlocks.js')
const siblingBlocks = require('./resolvers/siblingBlocks.js')
const self = require('./resolvers/self.js')
const blockMatchesRoles = require('./resolvers/blockMatchesRoles.js')
const Block_content = require('./resolvers/Block_content.js')
const checkSlug = require('./resolvers/checkSlug.js')
const search = require('./resolvers/search.js')

const saveBlock = require('./mutations/saveBlock.js')
const {
	archiveBlocks,
	unarchiveBlocks,
} = require('./mutations/archiveBlocks.js')
const moveBlock = require('./mutations/moveBlock.js')
const addUrlToQueue = require('./mutations/addUrlToQueue.js')
const upload = require('./mutations/upload.js')

const mongoDB_ObjectID_scalar = require('./scalars/mongoDB_ObjectID_scalar.js')

// const { getFilterByKeysFunction, getFilterByLanguageFunction } = require('../functions.js')

module.exports = {
	// JSON: GraphQLJSON,
	JSONObject: GraphQLJSONObject,
	Upload: GraphQLUpload,

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

	ObjectID: mongoDB_ObjectID_scalar,

	Query: {
		// hello: (parent, args, context, info) => 'world',

		id: (parent, args, context, info) => (new context.mongodb.ObjectId())+'',
		// whoami: (parent, args, context, info) => (!!context.profileID ? context.profileID+'' : null),

		block,
		blocks,
		// all_subblocks,
		blockBySlug,
		blocksBySlugs,
		self,
		parentBlocks,
		siblingBlocks,
		blockMatchesRoles,
		checkSlug,
		search,
	},
	Mutation: {
		saveBlock,
		archiveBlocks,
		unarchiveBlocks,
		moveBlock,
		addUrlToQueue,
		upload,
	},

	Block: {
		// description: getFilterByLanguageFunction('description'),
		// tags: getFilterByKeysFunction('tags'),
		content: Block_content,
	}
}

