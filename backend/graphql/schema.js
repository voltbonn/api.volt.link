const { gql } = require('apollo-server-express')

// scalar Date
// scalar Time
// scalar DateTime
//
// scalar Timestamp

const schema = gql`
	scalar JSON
	scalar JSONObject
	scalar DateTime

	type Query {
		id: ID

		block(_id: ID!): Block
		blocks(ids: [ID], types: [String]): [Block]
		all_subblocks(_id: ID!): [Block]
		blockBySlug(slug: String!): Block
		self: User
		parentBlocks(_id: ID!): [Block]
		siblingBlocks(_id: ID!): [Block]
	}

	type Mutation {
		saveBlock(block: InputBlock!): ID
	}

	type User {
		user: JSONObject
		logged_in: Boolean
		blockId: ID
	}

	type Metadata {
		modified: DateTime
		created: DateTime
	}

	enum BlockType {
		person
		page
		headline
		text
		button
	}

	type ContentConfig {
		blockId: ID
	}

	type Block {
		_id: ID
		type: String
		properties: JSON
		content: [ContentConfig]
		parent: ID
		metadata: Metadata
		permissions: [Permission]
		computed: JSON
	}

	type Permission {
		email: String
		role: String
	}

	input InputBlock {
		_id: ID
		type: String!
		properties: JSON
		content: [JSON]
		parent: ID
		metadata: JSON
		permissions: JSON
	}




	type Text {
		text: String
		locale: String
	}

	enum IconType {
		url
		emoji
	}

	type Icon {
		type: IconType
		text: String
		link: String
	}

	type CommonProperties {
		text: [Text]
		link: String
		slug: String
		icon: Icon
		coverphoto: String
  	imprint: String
  	privacy_policy: String
		listenOnPath: String
	}
`

module.exports = schema

const sampleBlock1 = {
	type: 'actions', // add 'empty' type when only used for actions
	properties: {},
	content: [
		{
			type: 'action',
			properties: {
				trigger: {
					type: 'path',
					path: 'example',
				},
				action: {
					type: 'open_url',
					url: 'https://www.example.org',
				}
			}
		},
		{
			trigger: {
				type: 'path',
				path: 'test_slug',
			},
			action: {
				type: 'render_block',
				blockId: 'test_block_id', // renders this block if not provided
			}
		},
		{
			trigger: {
				type: 'cron',
				cron: '45 23 * * 6',
			},
			action: {
				action: 'run_block',
				blockId: 'test_block_id', // runs this block if not provided
			}
		},
		{
			trigger: {
				type: 'click',
			},
			action: {
				type: 'open_url',
				url: 'https://www.example.org',
			}
		},
		{
			type: 'action',
			properties: {
				trigger: {
					type: 'block_change', // this is like a hook
					blockId: 'test_block_id', // triggered by the parent block if not provided
				},
				action: {
					type: 'send_payload',
					url: 'https://www.example.org',
				}
			}
		}
	]
}

const sampleBlock2 = {
	type: 'page',
	properties: {
		actionsBlockId: 'actions_block_id', // this or
		isActionsForBlockId: 'actions_block_id', // that
		trigger: {
			type: 'path',
			path: 'test_slug',
		},
		action: {
			type: 'render_block',
			blockId: 'test_block_id', // renders this block if not provided
		},
	},
	content: [
		{
			type: 'button',
			properties: {
				text: 'button-label',
				trigger: {
					type: 'click',
				},
				action: {
					type: 'open_url',
					url: 'https://www.example.org',
				},
			},
		},
		{
			type: 'code',
			properties: {
				language: 'javascript',
				text: `
					function (input) {
						console.log('input', input)

						return {
							text: 'Hello World',
						}
					}
				`,
			},
		},
		{
			type: 'code',
			properties: {
				language: 'javascript',
				text: `
					function (input) {
						console.log('input', input) // { text: 'Hello World' }

						return input.text
					}
				`,
			},
		}
	],
}
