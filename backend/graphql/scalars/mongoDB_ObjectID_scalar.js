const { GraphQLScalarType, Kind } = require('graphql')
const { ObjectId } = require('mongodb')

const mongoDB_ObjectID_scalar = new GraphQLScalarType({
  name: 'ObjectID',
  description: 'A custom scalar for mongoDB objectIds.',
  serialize(value) {
    return value+'' // Convert outgoing ObjectID to string for JSON
  },
  parseValue(value) {
    // Convert incoming string to ObjectId for MongoDB
    if (value && ObjectId.isValid(value)) {
			return new ObjectId(value)
		}
    throw new Error('Provided value is not an objectID.')
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      const value = ast.value
      if (value && ObjectId.isValid(value)) {
			  return new ObjectId(value) // Convert hard-coded AST string to integer and then to Date
      }
    }
    throw new Error('Provided value is not an objectID.')
  },
})

module.exports = mongoDB_ObjectID_scalar
