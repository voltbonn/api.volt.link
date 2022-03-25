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
	scalar ObjectID

	type Query {
		id: ObjectID

		block(_id: ObjectID!): Block
		blocks(ids: [ObjectID], types: [String], archived: Boolean, roots: [ObjectID]): [Block]
		all_subblocks(_id: ObjectID!): [Block]
		blockBySlug(slug: String!): Block
		self: User
		parentBlocks(_id: ObjectID!): [Block]
		siblingBlocks(_id: ObjectID!, types: [String]): [Block]
		blockMatchesRoles(_id: ObjectID!, roles: [String]): Boolean
	}

	type Mutation {
		saveBlock(block: InputBlock!): ObjectID
		archiveBlock(_id: ObjectID!): Boolean
		unarchiveBlock(_id: ObjectID!): Boolean
		moveBlock(movingBlockId: ObjectID!, newParentId: ObjectID!, newIndex: Int!): Boolean
	}

	type User {
		user: JSONObject
		logged_in: Boolean
		blockId: ObjectID
	}

	type Metadata {
		modified: DateTime
		modified_by: String
	}

	enum BlockType {
		person
		page
		headline
		text
		button
	}

	type ContentConfig {
		blockId: ObjectID
		block: Block
	}

	type Computed {
		roles: [String]
		sort: Int
	}

	type Block {
		_id: ObjectID
		type: String
		properties: JSON
		content: [ContentConfig]
		parent: ObjectID
		metadata: Metadata
		permissions: JSON
		computed: Computed
	}

	type Permission {
		email: String
		role: String
	}

	input InputContentConfig {
		blockId: ObjectID
	}

	input InputBlock {
		_id: ObjectID
		type: String!
		properties: JSON
		content: [InputContentConfig]
		parent: ObjectID
		metadata: JSON
		permissions: JSON
		computed: JSON
	}





	enum IconType {
		url
		emoji
		file
	}
	type Icon {
		type: IconType
		url: String
		emoji: String
		fileId: ObjectID
	}

	enum PhotoType {
		url
		file
	}
	type Photo {
		type: PhotoType
		url: String
		fileId: ObjectID
	}

	type CommonProperties {
		text: String
		icon: Icon
		coverphoto: Photo
  	imprint: String
  	privacy_policy: String
	}
`

module.exports = schema

const sampleBlock1 = {
	type: 'automation', // add 'empty' type when only used for automation
	properties: {},
	content: [
		{
			type: 'automation',
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

const sampleBlock3 = {
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
	content: [],
}
