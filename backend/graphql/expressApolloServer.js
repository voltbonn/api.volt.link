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

const isDevEnvironment = process.env.environment === 'dev' || false

const { ApolloServer } = require('apollo-server-express')
const {
	ApolloServerPluginDrainHttpServer,
	ApolloServerPluginLandingPageGraphQLPlayground,
	ApolloServerPluginLandingPageDisabled,
} = require('apollo-server-core')
const graphqlUploadExpress = require('graphql-upload/graphqlUploadExpress.js')

const getMongoDbContext = require('../getMongoDbContext.js')

const executableSchema = require('./executableSchema.js')

const apolloTracing = require('apollo-tracing')

async function startApolloServer(app, httpServer) {
  const apolloServer = new ApolloServer({
		schema: executableSchema,
		// Enable graphiql gui
		introspection: true,
		tracing: isDevEnvironment,
		context: async ({req}) => {
			try {
				const locales = req.acceptsLanguages()

				return {
					locale: locales.length > 0 ? locales[0] : 'en',
					logged_in: req.logged_in,
					user: req.user,
					mongodb: await getMongoDbContext(),
				}
			} catch (error) {
				console.error(error)
			}

			return null
		},
    plugins: [
			...(isDevEnvironment ? [] : [apolloTracing.plugin()]),
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

	app.use(graphqlUploadExpress({ maxFileSize: 5 * 1000 * 1000 })) // max 5MB

  apolloServer.applyMiddleware({ app, path: '/graphql/v1', cors: false })
}

exports = module.exports = startApolloServer
