
const getMongoDbContext = require('./getMongoDbContext.js')
const {
  localReadFileAtCommit,
  localListCommitsWithFiles,
} = require('./git_functions.js')

const {
  performance
} = require('perf_hooks')

const yaml = require('js-yaml')

const levenshtein = require('damerau-levenshtein')

const THOMAS_EMAIL = 'thomas.rosen@volteuropa.org'

const _blockIds_ = []


function _phpCastString (value) {
  // original by: Rafał Kukawski
  //   example 1: _phpCastString(true)
  //   returns 1: '1'
  //   example 2: _phpCastString(false)
  //   returns 2: ''
  //   example 3: _phpCastString('foo')
  //   returns 3: 'foo'
  //   example 4: _phpCastString(0/0)
  //   returns 4: 'NAN'
  //   example 5: _phpCastString(1/0)
  //   returns 5: 'INF'
  //   example 6: _phpCastString(-1/0)
  //   returns 6: '-INF'
  //   example 7: _phpCastString(null)
  //   returns 7: ''
  //   example 8: _phpCastString(undefined)
  //   returns 8: ''
  //   example 9: _phpCastString([])
  //   returns 9: 'Array'
  //   example 10: _phpCastString({})
  //   returns 10: 'Object'
  //   example 11: _phpCastString(0)
  //   returns 11: '0'
  //   example 12: _phpCastString(1)
  //   returns 12: '1'
  //   example 13: _phpCastString(3.14)
  //   returns 13: '3.14'

  const type = typeof value

  switch (type) {
    case 'boolean':
      return value ? '1' : ''
    case 'string':
      return value
    case 'number':
      if (isNaN(value)) {
        return 'NAN'
      }

      if (!isFinite(value)) {
        return (value < 0 ? '-' : '') + 'INF'
      }

      return value + ''
    case 'undefined':
      return ''
    case 'object':
      if (Array.isArray(value)) {
        return 'Array'
      }

      if (value !== null) {
        return 'Object'
      }

      return ''
    case 'function':
      // fall through
    default:
      throw new Error('Unsupported value type')
  }
}
function strip_tags (input, allowed) { // eslint-disable-line camelcase
  //  discuss at: https://locutus.io/php/strip_tags/
  // original by: Kevin van Zonneveld (https://kvz.io)
  // improved by: Luke Godfrey
  // improved by: Kevin van Zonneveld (https://kvz.io)
  //    input by: Pul
  //    input by: Alex
  //    input by: Marc Palau
  //    input by: Brett Zamir (https://brett-zamir.me)
  //    input by: Bobby Drake
  //    input by: Evertjan Garretsen
  // bugfixed by: Kevin van Zonneveld (https://kvz.io)
  // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
  // bugfixed by: Kevin van Zonneveld (https://kvz.io)
  // bugfixed by: Kevin van Zonneveld (https://kvz.io)
  // bugfixed by: Eric Nagel
  // bugfixed by: Kevin van Zonneveld (https://kvz.io)
  // bugfixed by: Tomasz Wesolowski
  // bugfixed by: Tymon Sturgeon (https://scryptonite.com)
  // bugfixed by: Tim de Koning (https://www.kingsquare.nl)
  //  revised by: Rafał Kukawski (https://blog.kukawski.pl)
  //   example 1: strip_tags('<p>Kevin</p> <br /><b>van</b> <i>Zonneveld</i>', '<i><b>')
  //   returns 1: 'Kevin <b>van</b> <i>Zonneveld</i>'
  //   example 2: strip_tags('<p>Kevin <img src="someimage.png" onmouseover="someFunction()">van <i>Zonneveld</i></p>', '<p>')
  //   returns 2: '<p>Kevin van Zonneveld</p>'
  //   example 3: strip_tags("<a href='https://kvz.io'>Kevin van Zonneveld</a>", "<a>")
  //   returns 3: "<a href='https://kvz.io'>Kevin van Zonneveld</a>"
  //   example 4: strip_tags('1 < 5 5 > 1')
  //   returns 4: '1 < 5 5 > 1'
  //   example 5: strip_tags('1 <br/> 1')
  //   returns 5: '1  1'
  //   example 6: strip_tags('1 <br/> 1', '<br>')
  //   returns 6: '1 <br/> 1'
  //   example 7: strip_tags('1 <br/> 1', '<br><br/>')
  //   returns 7: '1 <br/> 1'
  //   example 8: strip_tags('<i>hello</i> <<foo>script>world<</foo>/script>')
  //   returns 8: 'hello world'
  //   example 9: strip_tags(4)
  //   returns 9: '4'
  
  // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
  allowed = (((allowed || '') + '').toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join('')
  const tags = /<\/?([a-z0-9]*)\b[^>]*>?/gi
  const commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi
  let after = _phpCastString(input)
  // removes tha '<' char at the end of the string to replicate PHP's behaviour
  after = (after.substring(after.length - 1) === '<') ? after.substring(0, after.length - 1) : after
  // recursively remove tags to ensure that the returned string doesn't contain forbidden tags after previous passes (e.g. '<<bait/>switch/>')
  while (true) {
    const before = after
    after = before.replace(commentsAndPhpTags, '').replace(tags, function ($0, $1) {
      return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : ''
    })
    // return once no more tags are removed
    if (before === after) {
      return after
    }
  }
}

// async function delete_all_blocks(res) {
//   // delete all blocks from mongodb
//   const mongoDbContext = await getMongoDbContext()
//   const blocks = mongoDbContext.collections.blocks
//   blocks.deleteMany({}, (error, result) => {
//     if (error) {
//       console.error(error)
//       res.send(error)
//     } else {
//       res.send(`deleted ${result.deletedCount} blocks`)
//     }
//   })
// }

async function delete_all_history(mongoDbContext) {
  return new Promise(async resolve => {
    // delete all blocks from mongodb
    mongoDbContext.collections.history
    .deleteMany({}, (error, result) => {
      if (error) {
        console.error(error)
        throw(error)
      } else {
        console.log(`deleted ${result.deletedCount} blocks in history`)
      }
      resolve(true)
    })
  })
}

async function delete_all_blocks(mongoDbContext) {
  return new Promise(async resolve => {
    // delete all blocks from mongodb
    mongoDbContext.collections.blocks
    .deleteMany({}, (error, result) => {
      if (error) {
        console.error(error)
        throw(error)
      } else {
        console.log(`deleted ${result.deletedCount} blocks`)
      }
      resolve(true)
    })
  })
}

function strip_some_html_tag(text){
  return strip_tags(text, '<b><strong><em><i><br><a><img>')
}

function reformatTranslatedText(oldTranslations) {
  const properties = {}

  if (Array.isArray(oldTranslations) === false || oldTranslations.length === 0) {
    return null
  }

  const firstItem = oldTranslations.shift()
  properties.locale = firstItem.locale === 'en' ? null : firstItem.locale
  properties.text = strip_some_html_tag(firstItem.value)

  const translations = oldTranslations
  .map(text => ({
    locale: text.locale === 'en' ? null : text.locale,
    text: strip_some_html_tag(text.value),
  }))
  if (translations.length > 0) {
    properties.translations = translations
  }

  return properties
}

async function parseItem(item, mongoDbContext, parentBlockLess) {
  return new Promise(async resolve => {
    const newBlock = {
      _id: new mongoDbContext.ObjectId(),
      type: 'text',
      properties: {},
      metadata: parentBlockLess.metadata,
      permissions: parentBlockLess.permissions,
    }

    // START type
    switch (item.type) {
      case 'link':
        newBlock.type = 'button'
        break
      case 'headline':
        newBlock.type = 'text'
        newBlock.properties.text_style = 'h2'
        break
      case 'headline3':
        newBlock.type = 'text'
        newBlock.properties.text_style = 'h3'
        break
      case 'text':
        newBlock.type = 'text'
        break
      default:
        newBlock.type = 'text'
        break
    }
    // END type


    const oldType = item.type || ''

    // START text
    switch (newBlock.type) {
      case 'button':
        newBlock.properties = {
          ...newBlock.properties,
          ...reformatTranslatedText(item.title),
        }
        break
      case 'text':
        newBlock.properties = {
          ...newBlock.properties,
          ...reformatTranslatedText(
            oldType.startsWith('headline')
              ? item.title
              : item.text
          ),
        }
        break
      default:
        newBlock.properties = {
          ...newBlock.properties,
          ...reformatTranslatedText(item.text),
        }
        break
    }
    // END text


    // START link
    if (
      newBlock.type === 'button'
      && typeof item.link === 'string'
      && item.link !== ''
    ) {
      newBlock.properties.trigger = {
        type: 'click',
      }
      newBlock.properties.action = {
        type: 'open_url',
        url: item.link,
      }
    }
    // END link


    // START active
    if (
      typeof item.active === 'boolean'
      && item.active !== null
      && item.active === false
    ) {
      newBlock.properties.active = false
    }
    // END active

    // if (newBlock.type === 'button') {
    //   console.log('item-newBlock', JSON.stringify(newBlock, null, 2))
    // }

    resolve(newBlock)
  })
}

function getTrigger(filepath2match){
  const filenameMatched = /^paths\/(.+)\.yml$/.exec(filepath2match)
  if (filenameMatched) {
    return {
      trigger: {
        type: 'path',
        path: filenameMatched[1],
      }
    }
  }

  return null
}

async function parseOldLinklistFile(content, mongoDbContext, fileinfo = {}) {
  const {
    commitInfo,
  } = fileinfo

  const {
    iso_ts,
  } = commitInfo



  const newBlock = {
    _id: new mongoDbContext.ObjectId(),
    type: 'page',
    properties: {},
  }

  // NOTE: content.volt_team will not be added. But I somehow want to reference these afterwards. I will add the feature later in the client. It won't be imported.



  // START type
  let type = 'page'

  if (content.use_as === 'linklist' && content.layout === 'person') {
    type = 'person'
  } else if (content.use_as === 'linklist' && content.layout === 'default') {
    type = 'page'
  } else if (content.use_as === 'redirect') {
    type = 'redirect'
  }

  newBlock.type = type

  // # person
  // use_as: linklist
  // layout: person
  //
  // # page
  // use_as: linklist
  // layout: default
  //
  // # redirect
  // use_as: redirect
  // redirect: https://linktr.ee/voltbonn/
  // END type



  // START overwrites
  newBlock.properties = {
    ...newBlock.properties,
    ...content.overwrites,
  }
  // END overwrites


  // START coverphoto
  if (!!content.coverphoto && content.coverphoto !== '') {
    if (newBlock.type === 'person') {
      newBlock.properties.icon = { type: 'url', url: content.coverphoto }
    } else {
      newBlock.properties.coverphoto = { type: 'url', url: content.coverphoto }
    }
  }
  // END coverphoto


  // START title
  if (content.title) {
    newBlock.properties = {
      ...newBlock.properties,
      ...reformatTranslatedText(content.title)
    }
  }
  // END title

  // START description
  if (content.description && content.description.length > 0) {
    if (
      !(!!content.items)
      || content.items.length === 0
      || Array.isArray(content.items) === false
    ) {
      content.items = []
    }
    content.items.unshift({
      type: 'text',
      text: content.description,
    })
  }
  // END description



  // START trigger
  let filepath2match = fileinfo.filepath
  if (fileinfo.status_letter === 'R' || fileinfo.status_letter === 'C') {
    filepath2match = fileinfo.new_filepath
  }

  newBlock.properties = {
    ...newBlock.properties,
    ...getTrigger(filepath2match),
  }
  // END trigger



  // START action
  if (newBlock.type === 'redirect') {
    if (!!content.redirect && content.redirect !== '') {
      newBlock.properties.action = {
        type: 'open_url',
        url: content.redirect,
      }
    }
  } else {
    newBlock.properties.action = {
      type: 'render_block',
    }
  }
  // END action



  // START metadata
  newBlock.metadata = {}

  if (content.last_modified) {
    newBlock.metadata.modified = new Date(content.last_modified)
  } else {
    newBlock.metadata.modified = new Date(iso_ts)
  }

  if (content.last_modified_by) {
    newBlock.metadata.modified_by = content.last_modified_by      
  } else {
    newBlock.metadata.modified_by = THOMAS_EMAIL
  }
  // END metadata


  // START permissions
  let blockPermissions = (content.permissions || [])
  .map(permission => ({
    email: permission.value,
    role: permission.role,
  }))

  if (blockPermissions.length === 0) {
    blockPermissions.push({
      email: THOMAS_EMAIL,
      role: 'owner',
    })
  } else if (blockPermissions.filter(p => p.role === 'owner').length === 0) { // make sure a owner exists
    const firstEntry = blockPermissions.shift() // get the first permissions entry and remove it from the list
    blockPermissions.unshift({ // add-back the shifted item with a different role
      email: firstEntry.email,
      role: 'owner',
    })
  }

  if (
    (
      content.use_as === 'linklist'
      || content.use_as === 'redirect'
    )
    && blockPermissions.filter(p => p.email === '@volteuropa.org').length === 0
  ) {
    blockPermissions.push({
      email: '@public',
      role: 'viewer',
    })
  }

  // save permissions as full-block-permissions
  const permissions = {
    '/': blockPermissions
  }

  newBlock.permissions = permissions
  // END permissions


  // START content / items
  const blockContent = []

  const items = content.items || []
  for (const item of items) {
    const block = await parseItem(item, mongoDbContext, {
      metadata: newBlock.metadata,
      permissions: newBlock.permissions,
    })

    blockContent.push({
      item: JSON.stringify(item), // We only need it to compare old and new items.
      block,
      commonId: new mongoDbContext.ObjectId(),
    })
  }

  newBlock.content = blockContent
  // END content / items


   return newBlock
}

function getNewestBlockInfoByFilepath(filepath = '', new_filepath = '') {
  let oldFilepath = ''
  let currentFilepath = ''
  if (
    typeof filepath === 'string'
    && typeof new_filepath === 'string'
    && filepath !== ''
    && new_filepath !== ''
  ) {
    oldFilepath = filepath
    currentFilepath = new_filepath
  } else {
    oldFilepath = filepath
    currentFilepath = filepath
  }

  let foundIndex = -1
  let foundNewestHistoryBlockInfo = {
    blockInfo: null,
    newestBlockInfo: null,
  }

  for (let i = 0; i < _blockIds_.length; i += 1) {
    const thisBlockIdsList = _blockIds_[i]

    // sort historyIds by date_modified property
    const historyIdsSorted = thisBlockIdsList.historyIds.sort((a, b) => {
      return b.date_modified - a.date_modified
    })

    // get newest item from historyIds
    const newestHistoryBlockInfo = historyIdsSorted[0]

    if (
      (
        typeof oldFilepath === 'string'
        && oldFilepath.length > 0
        && newestHistoryBlockInfo.filepath === oldFilepath
      )
      || newestHistoryBlockInfo.filepath === currentFilepath
    ) {
      foundIndex = i
      foundNewestHistoryBlockInfo.blockInfo = thisBlockIdsList
      foundNewestHistoryBlockInfo.newestBlockInfo = newestHistoryBlockInfo
      break
    }
  }

  return foundNewestHistoryBlockInfo
}

function addToBlockIdsList(filepath = '', new_filepath = '', newBlock, mongoDbContext){
  let commonId = null

  let oldFilepath = ''
  let currentFilepath = ''
  if (
    typeof filepath === 'string'
    && typeof new_filepath === 'string'
    && filepath !== ''
    && new_filepath !== ''
  ) {
    oldFilepath = filepath
    currentFilepath = new_filepath
  } else {
    oldFilepath = filepath
    currentFilepath = filepath
  }

  let foundIndex = -1
  let foundNewestHistoryBlockInfo = null

  for (let i = 0; i < _blockIds_.length; i += 1) {
    const thisBlockIdsList = _blockIds_[i]

    // sort historyIds by date_modified property
    const historyIdsSorted = thisBlockIdsList.historyIds.sort((a, b) => {
      return b.date_modified - a.date_modified
    })

    // get newest item from historyIds
    const newestHistoryBlockInfo = historyIdsSorted[0]

    if (
      (
        typeof oldFilepath === 'string'
        && oldFilepath.length > 0
        && newestHistoryBlockInfo.filepath === oldFilepath
      )
      || newestHistoryBlockInfo.filepath === currentFilepath
    ) {
      foundIndex = i
      foundNewestHistoryBlockInfo = newestHistoryBlockInfo
      break
    }
  }

  const newBlockInfo = {
    date_modified: newBlock.metadata.modified,
    blockId: newBlock._id,
    filepath: currentFilepath,
    items: [],
  }

  if (foundIndex > -1) {
    commonId = _blockIds_[foundIndex].commonId
    _blockIds_[foundIndex].historyIds.push(newBlockInfo)
  } else if (!_blockIds_.hasOwnProperty(currentFilepath)) {
    commonId = new mongoDbContext.ObjectId()
    _blockIds_.push({
      commonId,
      historyIds: [ newBlockInfo ],
    })
  }
  
  return {
    commonId,
    prevBlockInfos: foundNewestHistoryBlockInfo,
  }
}

// function getNewestBlockInfos(commonId) {
//   let parentBlockInfos = _blockIds_.filter(blockInfos => blockInfos.commonId === commonId)
//   if (parentBlockInfos.length > 0) {
//     parentBlockInfos = parentBlockInfos[0]
//
//     if (parentBlockInfos.historyIds.length > 0) {
//       const historyIdsSorted = parentBlockInfos.historyIds
//         .sort((a, b) => b.date_modified - a.date_modified)
//
//       const newestHistoryBlockInfo = historyIdsSorted[0]
//
//       return newestHistoryBlockInfo
//     }
//   }
//
//   return null
// }

async function addBlockToHistory(block, mongoDbContext) {
  // add block as doc to mongoDB collection called history
  const history = mongoDbContext.collections.history
  try {
    await history.insertOne(block)
  } catch (error) {
    console.log('error-in-block:', JSON.stringify(block, null, 2))
    console.error('error-msg:', error)
  }
}

// async function updateBlockInHistory(block, mongoDbContext) {
//   // update block in mongoDB collection called history
//   const history = mongoDbContext.collections.history
//   await history.updateOne({ _id: block._id }, { $set: block })
// }

function setItemsForBlockInfo(commomId, newItems) {
  const index = _blockIds_.findIndex(blockInfos => blockInfos.commonId === commomId)
  if (index > -1) {
    
    const historyIdsSorted = _blockIds_[index].historyIds.sort((a, b) => {
      return b.date_modified - a.date_modified
    })

    const newestItem = historyIdsSorted.shift() // remove newest item from historyIdsSorted
    newestItem.items = newItems // set items
    _blockIds_[index].historyIds.unshift(newestItem) // add newest item back to historyIdsSorted
  }
}

async function addFileToHistory(fileinfo, mongoDbContext) {
  return new Promise(async resolve => {

    if (fileinfo.status_letter === 'D') {
      // TODO: Load prev block from db and add archived property to it. And update metadata.modified timestamp.
      // Get prev block from _blockIds_.
      //
      // const newHistoryBlock = {
      //   properties: {
      //     archived: true
      //   },
      // }

      const {
        blockInfo,
        newestBlockInfo,
      } = getNewestBlockInfoByFilepath(fileinfo.filepath, fileinfo.new_filepath)
      
      if (blockInfo === null) {
        // Create new block.
        // This "if" should never be called, if everythign is in it's correct oder.

        const newBlock = {
          _id: new mongoDbContext.ObjectId(),
          type: 'page',
          properties: {
            ...getTrigger(fileinfo.filepath), // fileinfo.new_filepath is unset for "D" (deleting)
            archived: true,
          },
          metadata: {
            modified: fileinfo.commitInfo.iso_ts,
            modified_by: THOMAS_EMAIL,
          },
        }

        const {
          commonId,
        } = addToBlockIdsList(fileinfo.filepath, fileinfo.new_filepath, newBlock, mongoDbContext)
        setItemsForBlockInfo(commonId, [])
        await addBlockToHistory(newBlock, mongoDbContext)
      } else {
        // copy old block and change it to archived

        // load block from db with _id = blockInfo.blockId
        const history = mongoDbContext.collections.history
        const oldBlock = await history.findOne({ _id: newestBlockInfo.blockId })

        const newBlock = {
          ...oldBlock,
          _id: new mongoDbContext.ObjectId(),
          isHistoryFor: blockInfo.commonId,
          properties: {
            ...oldBlock.properties,
            archived: true,
          },
          metadata: {
            ...oldBlock.metadata,
            modified: fileinfo.commitInfo.iso_ts,
          },
        }

        const {
          commonId,
        } = addToBlockIdsList(fileinfo.filepath, fileinfo.new_filepath, newBlock, mongoDbContext)
        setItemsForBlockInfo(commonId, [])
        await addBlockToHistory(newBlock, mongoDbContext)
      }
      
    } else {

      let filepath = fileinfo.filepath
      if (fileinfo.status_letter === 'R' || fileinfo.status_letter === 'C') {
        filepath = fileinfo.new_filepath
      }

      const textContent = await localReadFileAtCommit(filepath, fileinfo.commitHash)
      const content = yaml.load(textContent)

      if (
        typeof content === 'object'
        && content !== null
        && !Array.isArray(content)
      ) {
      const newBlock = await parseOldLinklistFile(content, mongoDbContext, fileinfo)

      const {
        commonId,
        prevBlockInfos,
      } = addToBlockIdsList(filepath, fileinfo.new_filepath, newBlock, mongoDbContext)

      newBlock.isHistoryFor = commonId

      // START match items to older versions and add, update or archive neccerary items

      // A–>B
      // * ähnlichstes item finden (levenstein über JSON davon)
      // * Wenn B mehr items hat:
      //   - Matches updaten.
      //   - Weitere neu erstellen.
      // * Wenn A mehr items hat:
      //   - Matches updaten.
      //   - Zuviel als archiviert markieren.
      // * In history vermerken

      const newestBlockInfos = prevBlockInfos

      let oldItems = []
      let newItems = newBlock.content

      if (newestBlockInfos === null) {
        oldItems = []
      } else {
        oldItems = newestBlockInfos.items
      }


      if (oldItems.length === 0) {
        // Block is new. So all items are new. Everything can be added.
        for (const { block, commonId } of newItems) {
          block.isHistoryFor = commonId
          await addBlockToHistory(block, mongoDbContext)
        }
      } else {
        // Check items:

        for (let i = 0; i < newItems.length; i += 1) {
          const { item } = newItems[i]

          const oldItemIndex = oldItems.findIndex(oldItem => oldItem.item === item)

          if (oldItemIndex > -1) {
            // Item is already in history.
          
            // return and remove item at index
            let oldItem = oldItems.splice(oldItemIndex, 1)
            oldItem = oldItem[0]
          
            newItems[i].block = oldItem.block

            // No need to add-to or update DB.
          } else {
            // find nearest item index
            
            let maxLevelsteinSimilarity = 0
            let maxLevelsteinItemIndex = -1

            for (let i = 0; i < oldItems.length; i += 1) {
              const { item: oldItem } = oldItems[i]
              const thisLevelstein = levenshtein(oldItem, item)
              const similarity = thisLevelstein.similarity

              if (similarity > maxLevelsteinSimilarity) {
                maxLevelsteinSimilarity = similarity
                maxLevelsteinItemIndex = i
              }
            }

            if (maxLevelsteinItemIndex > -1) {
              // Found a nearest item.

              // return and remove item at index
              let oldItem = oldItems.splice(maxLevelsteinItemIndex, 1)
              oldItem = oldItem[0]

              newItems[i].block.isHistoryFor = oldItem.commonId
            } else {
              // Item is new. Add it as it is.
              newItems[i].block.isHistoryFor = newItems[i].commonId
            }

            await addBlockToHistory(newItems[i].block, mongoDbContext)
          }
        }

        // mark unmatched old-items as archived
        for (const oldItem of oldItems) {
          const newOldBlock = {
            ...oldItem.block,
            _id: new mongoDbContext.ObjectId(),
            isHistoryFor: oldItem.commonId,
            properties: {
              ...oldItem.block.properties,
              archived: true,
            },
            metadata: {
              ...oldItem.block.metadata,
              modified: fileinfo.commitInfo.iso_ts,
            },
          }
          await addBlockToHistory(newOldBlock, mongoDbContext)
        }
      }

      // only save blockId in the database
      newBlock.content = newItems.map(({ block }) => ({ blockId: block.isHistoryFor }))

      setItemsForBlockInfo(commonId, newItems)
      // END match items to older versions and add, update or archive neccerary items

      await addBlockToHistory(newBlock, mongoDbContext)
    }

    }

    resolve(null)
  })
}

async function addNewestHistoryToBlocks(mongoDbContext){
  const cursor = mongoDbContext.collections.history.aggregate([
    {$sort: {
      'metadata.modified': -1,
    }},
    {$group: {
      _id: '$isHistoryFor',
      block: { $first: '$$ROOT' },
    }},
    {$set: {
      'block._id': '$_id',
    }},
    { $unset: 'block.isHistoryFor' },
    { $replaceRoot: { newRoot: '$block' } },
    { $out: { db: 'graph', coll: 'blocks' } },
  ])

  // log docs from cursor
  const docs = await cursor.toArray()

  return docs // docs should be an empty array
}

async function import_old() { 
  console.info('Started the Import!') 
  const startTS = performance.now()

  // Read old data from git and write it to mongodb in the new format:

  const mongoDbContext = await getMongoDbContext()
  // console.log(JSON.stringify(Object.keys(mongoDbContext), null, 2))

  await delete_all_history(mongoDbContext)
  await delete_all_blocks(mongoDbContext)

  const commits = await localListCommitsWithFiles({ max_commits: 10000 })
  const loadedCommitTS = performance.now()

  console.info(`${commits.length} commits loaded in`, loadedCommitTS - startTS, 'ms')

  let todoCommitCounter = commits.length

  for (const commitInfo of commits) {
    const files = commitInfo.files
      .filter(fileinfo => fileinfo.filepath.startsWith('paths/') && fileinfo.filepath.endsWith('.yml')) // filter for only fies in paths folder and only use yaml-files (not .gitkeep)
      // .filter(fileinfo => fileinfo.status_letter === 'A')

    if (files.length > 0) {
      for (const fileinfo of files) {
        try {
          // if (fileinfo.status_letter === 'D') {
            console.log(`${commitInfo.commitHash} | ${fileinfo.status_letter} | ${todoCommitCounter} | ${fileinfo.filepath}`)
          // }

          await addFileToHistory(
            {
              commitHash: commitInfo.commitHash,
              commitInfo,
              ...fileinfo,
            },
            mongoDbContext
          )
        } catch (error) {
          console.error(error)
        }
      }
    }

    todoCommitCounter -= 1
    // console.info(`todo: ${todoCommitCounter}`)
  }

  const parsedFilesTS = performance.now()

  await addNewestHistoryToBlocks(mongoDbContext)

  const copiedBlocksTS = performance.now()

  // console.log(JSON.stringify(_blockIds_, null, 2))

  console.log('--------------------------------')
  console.log('loaded commits', loadedCommitTS - startTS, 'ms')
  console.log('parsed files  ', parsedFilesTS - loadedCommitTS, 'ms', '(+ added history blocks)')
  console.log('copied blocks ', copiedBlocksTS - parsedFilesTS, 'ms')
  console.log('--------------------------------')

  // process.exit(0)

  return `
----------------------------------------------------------------
commit amount  ${commits.length}
----------------------------------------------------------------
loaded commits ${loadedCommitTS - startTS} ms
parsed files   ${parsedFilesTS - loadedCommitTS} ms (+ added history blocks)
copied blocks  ${copiedBlocksTS - parsedFilesTS} ms
----------------------------------------------------------------
`
}

import_old()
  .then(console.log)
  .catch(console.error)
  .finally(() => {
    console.info('Finished the Import!') 
    process.exit(0)
  })

/*
  {
    "_id" : ObjectId("61b01773d37bb7774600568e"),
    "type" : "page",
    "history": {
      forID: ObjectId("61b01773d37bb7774600568e"),
      prevID: null,
      nextID: null,
    }
  }
*/
