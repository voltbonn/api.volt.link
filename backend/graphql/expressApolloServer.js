/*

async function expressApolloServer(app) {
	const server = new ApolloServer({
		schema: executableSchema,
		// Enable graphiql gui
		introspection: true,
		// tracing: true,
		playground: {
			settings: {
				'request.credentials': 'same-origin',
				'prettier.tabWidth': 4,
				'prettier.useTabs': true,
			},
			endpoint: '/graphql/v1',
		},
		context: async ({req}) => {
			try{
				return {
					mongodb: await getMongoDbContext(),
				}
			}catch (error) {
				console.error(error)
			}

			return null
		},
	}) // .applyMiddleware({app, path:'/graphql/v1', cors: true})
  await server.start();

	return server
}
*/

const { ApolloServer } = require('apollo-server-express')
const {
	ApolloServerPluginDrainHttpServer,
	ApolloServerPluginLandingPageGraphQLPlayground,
	ApolloServerPluginLandingPageDisabled,
} = require('apollo-server-core')

const getMongoDbContext = require('../getMongoDbContext.js')

const executableSchema = require('./executableSchema.js')

async function startApolloServer(app, httpServer) {
  const apolloServer = new ApolloServer({
		schema: executableSchema,
		// Enable graphiql gui
		introspection: true,
		tracing: true,
		context: async ({req}) => {
			try {
				return {
					mongodb: await getMongoDbContext(),
				}
			} catch (error) {
				console.error(error)
			}

			return null
		},
    plugins: [
			ApolloServerPluginDrainHttpServer({ httpServer }),
			(
    		true || process.env.environment === 'dev'
    		  ? ApolloServerPluginLandingPageGraphQLPlayground({
							settings: {
								'request.credentials': 'same-origin',
								'prettier.tabWidth': 4,
								'prettier.useTabs': true,
							},
							endpoint: '/graphql/v1',
						})
    		  : ApolloServerPluginLandingPageDisabled()
			),
  ],
  })
  await apolloServer.start()
  apolloServer.applyMiddleware({ app, path: '/graphql/v1', cors: false })
}

exports = module.exports = startApolloServer
