const { flattenObject } = require('../functions.js')

const getMongoDbContext = require('../getMongoDbContext.js')

const { get_new_id, is_id } = require('./id.js')

function createExpressRestServer (app) {

  app.get('/rest/v1/example/', function (req, res) {
    console.info('GET /rest/v1/example/')

    res.send(`
      <style>
        body {
          font-family: Ubuntu, sans-serif;
          font-size: 18px;
          line-height: 1.2;
          color: #502379;
          padding: 16px;
        }
        h1 {
          font-size: 32px;
        }
        p, ul, code {
          font-size: inherit;
        }
        code {
          font-family: "Ubuntu Mono", monospace;
        }
        p, li {
          margin-block-end: 16px;
        }
      </style>
      <h1>Volt.Link Rest-API Example</h1>
      <script>
        function add_node () {
          fetch("http://localhost:4004/rest/v1/node/", {
            method: "post",
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
          
            //make sure to serialize your JSON body
            body: JSON.stringify({
              node: {
                id: '123',
                type: 'text',
                content: 'Hello World'
              },
            })
          })
          .then(response => {
            console.info('addresponse', response)
            delete_node()
          });
        }

        function delete_node () {
          fetch("http://localhost:4004/rest/v1/node/?id=123", {
            method: "delete",
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
          })
          .then(response => {
            console.info('delete-response', response)
          });
        }

        add_node()
      </script>
    `)
  })

  app.get('/rest/v1/', function (req, res) {
    console.info('/rest/v1/')

    res.send(`
      <style>
        body {
          font-family: Ubuntu, sans-serif;
          font-size: 18px;
          line-height: 1.2;
          color: #502379;
          padding: 16px;
        }
        h1 {
          font-size: 32px;
        }
        p, ul, code {
          font-size: inherit;
        }
        code {
          font-family: "Ubuntu Mono", monospace;
        }
        p, li {
          margin-block-end: 16px;
        }
      </style>
      <h1>Volt.Link Rest-API</h1>
      <p>Get an API-key before using the API.</p>
      <ul>
        <h2>Nodes</h2>
        <li>
          POST /rest/v1/node/<br />
          <code>{ id: '123', type: 'text', content: 'Hello World' }</code>
        </li>
        <li>GET /rest/v1/node/?id=123</li>
        <li>DELETE /rest/v1/node/</li>

        <br />

        <h2>Properties</h2>
        <li>
          POST /rest/v1/property/<br />
          <code>{ id: '123', to_id: '123', property_key: 'key', property_value: 'value' }</code>
        </li>
        <li>GET /rest/v1/property/?id=123</li>
        <li>DELETE /rest/v1/property/</li>
      </ul>
    `)
  })

  app.get('/rest/v1/id/', async function (req, res) {
    // TODO check if logged in
    // TODO check an api-/access-key

    res.send({
      error: null,
      id: await get_new_id(),
    })
  })

  app.get('/rest/v1/node/', async function (req, res) {
    try {
      const mongodb = await getMongoDbContext()

      const node_id = req.query.id

      if (is_id(node_id)) {
        const found_node = await mongodb.collections.nodes
          .findOne({
            id: node_id,
          })

        if (found_node !== null) {
          res.send({
            error: null,
            node: found_node,
          })
        } else {
          res.send({
            error: 'not found',
            node: null,
          })
        }
      } else {
        res.send({
          error: 'no id',
          node: null,
        })
      }
    } catch (error) {
      console.error(error)
      res.send({
        error: error,
        node: null,
      })
    }
  })

  app.post('/rest/v1/node/', async function (req, res) {
    // TODO check if logged in
    // TODO check an api-/access-key

    try {
      const mongodb = await getMongoDbContext()
    
      const body = req.body

      if (body && body.node) {
        const node = body.node
        const node_id = node.id || null

        let id_is_given = (
          node.hasOwnProperty('id')
          && is_id(node_id)
        )

        let node_exists = false
        if (id_is_given) {
          // check if the node exists
          const node_exists_doc = await mongodb.collections.nodes
            .findOne({
              id: node_id,
            })

          if (typeof node_exists_doc === 'object' && node_exists_doc !== null) {
            // node already exists
            node_exists = true
          }
        }

        if (node_exists) {
          // The node exists: UPDATE IT.

          const updatePipline = []

          const unset = []
          const set = {}

          const flattened_node = flattenObject(node)

          for (const key in flattened_node) {
            if (key === 'id' || key === '_id') {
              // dont update the id or mongodb-id (_id)
              continue
            }

            const value = flattened_node[key]
            if (value === null) {
              unset.push(key)
            } else {
              set[key] = value
            }
          }

          const has_set_entries = Object.keys(set).length > 0
          const has_unset_entries = Object.keys(unset).length > 0

          if (has_set_entries || has_unset_entries) {

            // add metadata
            set['metadata.modified'] = new Date()
            // set['metadata.modified_by'] = user.email

            updatePipline.push({ $set: set })
            
            if (has_unset_entries) {
              updatePipline.push({ $unset: unset })
            }

            const updateResult = await mongodb.collections.nodes
              .updateOne(
                { id: node_id },
                updatePipline,
                { upsert: false }
              )

            if (updateResult.modifiedCount > 0) {
              // block updated
              res.send({
                error: null,
                id: node_id,
              })
            } else if (updateResult.matchedCount > 0) {
              // block was not updated
              // but everything is fine
              res.send({
                error: null,
                id: node_id,
              })
            } else { // updateResult.matchedCount === 0
              // block was not updated
              // because it could not be found
              throw new Error('Could not find the block.')
            }
          } else {
            // nothing to update
            res.send({
              error: null,
              info: 'Nothing to update.',
              id: node_id,
            })
          }
        } else {
          // The node does NOT exist: Create it!

          if (!id_is_given) {
            node.id = await get_new_id()
          }

          // metadata
          if (
            node.hasOwnProperty('metadata')
            && typeof node.metadata === 'object'
            && node.metadata !== null
            && !Array.isArray(node.metadata)
          ) {
            node.metadata = {
              ...node.metadata,
              // modified_by: user.email,
              modified: new Date(),
            }
          } else {
            node.metadata = {
              // modified_by: user.email,
              modified: new Date(),
            }
          }

          const result = await mongodb.collections.nodes
            .insertOne(node)

          if (result.acknowledged === true && !!result.insertedId) {
            // ✅ node created
            res.send({
              error: null,
              id: node.id,
            })
          } else {
            // node not created
            throw new Error('Could not create the node.')
          }
        }
      } else {
        throw new Error('No data given.')
      }
    } catch (error) {
      console.error(error)
      res.send({
        error: String(error),
        id: null,
      })
    }
  })

  app.delete('/rest/v1/node/', async function (req, res) {
    // TODO check if logged in
    // TODO check an api-/access-key

    try {

      const query = req.query || {}
      const node_id = query.id || null

      if (is_id(node_id)) {
        // delete node from the database

        const mongodb = await getMongoDbContext()

        const result = await mongodb.collections.nodes
          .deleteOne({
            id: node_id,
          })

        if (result.acknowledged === true || result.deletedCount > 0) {
          res.send({
            error: null,
            deleted: true,
            id: node_id, // the old id. just to be sure in the frontend
          })
        } else {
          throw new Error('Could not find and delete the node.')
        }
      } else {
        throw new Error('No id given.')
      }
    } catch (error) {
      console.error(error)
      res.send({
        error: String(error),
        deleted: false,
        id: null,
      })
    }
  })

  /*
  // TODO implement property api
  app.post('/rest/v1/add_property/', function (req, res) {
    // TODO check if logged in
    // TODO check an api-/access-key

    const body = req.body

    if (body && body.data) {
      const {
        to_id,
        property_key,
        property_value,
      } = body.data

      // TODO add property to database
    }

    res.send({
      error: null,
      data: {
        _id: '123',
      },
    })
  })
  */

  return app
}

module.exports = {
  createExpressRestServer,
}