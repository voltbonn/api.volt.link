db.getCollection('blocks').aggregate([
  {
    $match: {
      _id: { $in: [ObjectId('634b2497a66bb34542031dca'), ObjectId("635a9b6b769b889340629c2a")] }
    }
  },

  {
    $project: {
      root: '$$ROOT'
    }
  },
  {
    $set: {
      'root.unwindContent': '$root.content'
    }
  },
  {
    $unwind: {
      path: '$root.unwindContent',
      includeArrayIndex: 'contentIndex',
      preserveNullAndEmptyArrays: true,
    }
  },
  {
    $lookup: {
      from: 'blocks',
      localField: 'root.unwindContent.blockId',
      foreignField: '_id',
      as: 'newContent.block'
    }
  },
  { $addFields: { 'newContent.block': { $first: '$newContent.block' } } },
  { $addFields: { 'newContent.index': '$contentIndex' } },
  { $unset: ['contentIndex'] },
  // {
  //   $match: {
  //     'newContent.block._id': { $ne: null }, // todo: this needs to be in a facet, not not have an empty result
  //   }
  // },

  // ...isArchivedQueryStage, // TODO: does this work correctly?

  // // START permissions
  // ...getPermissionsAggregationQuery(context, roles, {
  //   startField: '$newContent.block._id', // todo: is this correct?
  // }),

  { $sort: { 'newContent.index': 1 } },
  // { $unset: ['newContent.index'] },

  {
    $group: {
      _id: '$_id',
      root: { $first: '$root' },
      newContent: { $push: '$newContent' },
    }
  },



  // START convert content to markdown and plaintext
  {
    $addFields: {
      'root.computed.contentAsPlaintextPerBlock': {
        $map: {
          input: '$newContent',
          as: 'contentConfig',
          in: {
            $toString: {
              $switch: {
                branches: [
                  {
                    case: {
                      $or: [
                        { $eq: ['$$contentConfig.block.type', 'text'] },
                        { $eq: ['$$contentConfig.block.type', 'code'] },
                        { $eq: ['$$contentConfig.block.type', 'button'] },
                      ]
                    },
                    then: '$$contentConfig.block.properties.text',
                  },
                  {
                    case: {
                      $or: [
                        { $eq: ['$$contentConfig.block.type', 'page'] },
                        { $eq: ['$$contentConfig.block.type', 'poster'] },
                        { $eq: ['$$contentConfig.block.type', 'redirect'] },
                      ]
                    },
                    then: {
                      $cond: {
                        if: {
                          $and: [
                            { $eq: ['$$contentConfig.block.properties.icon.type', 'emoji'] },
                            { $ne: ['$$contentConfig.block.properties.icon.emoji', ''] },
                          ]
                        },
                        then: {
                          $concat: [
                            '$$contentConfig.block.properties.icon.emoji',
                            ' ',
                            '$$contentConfig.block.properties.text'
                          ]
                        },
                        else: '$$contentConfig.block.properties.text',
                      }
                    },
                  },
                  // {
                  //   case: { $eq: ['$$contentConfig.block.type', 'divider'] },
                  //   then: '---'
                  // },
                ],
                default: ''
              }
            }
          }
        }
      },
      'root.computed.contentAsMarkdownPerBlock': {
        $map: {
          input: '$newContent',
          as: 'contentConfig',
          in: {
            $toString: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$$contentConfig.block.type', 'text'] },
                    then: {
                      $switch: {
                        branches: [
                          {
                            case: { $eq: ['$$contentConfig.block.properties.text_style', 'h1'] },
                            then: { $concat: ['# ', '$$contentConfig.block.properties.text'] },
                          },
                          {
                            case: { $eq: ['$$contentConfig.block.properties.text_style', 'h2'] },
                            then: { $concat: ['## ', '$$contentConfig.block.properties.text'] },
                          },
                          {
                            case: { $eq: ['$$contentConfig.block.properties.text_style', 'h3'] },
                            then: { $concat: ['### ', '$$contentConfig.block.properties.text'] },
                          }
                        ],
                        default: '$$contentConfig.block.properties.text'
                      }
                    }
                  },
                  {
                    case: { $eq: ['$$contentConfig.block.type', 'divider'] },
                    then: '---'
                  },
                  {
                    case: { $eq: ['$$contentConfig.block.type', 'button'] },
                    then: { $concat: ['[', '$$contentConfig.block.properties.text', '](', '$$contentConfig.block.properties.url', ')'] },
                  },
                  {
                    case: {
                      $or: [
                        { $eq: ['$$contentConfig.block.type', 'page'] },
                        { $eq: ['$$contentConfig.block.type', 'poster'] },
                        { $eq: ['$$contentConfig.block.type', 'redirect'] },
                      ]
                    },
                    then: {
                      $switch: {
                        branches: [
                          {
                            case: { $ne: ['$$contentConfig.block.properties.slug', ''] },
                            then: {
                              $concat: [
                                '[',
                                {
                                  $cond: {
                                    if: {
                                      $and: [
                                        { $eq: ['$$contentConfig.block.properties.icon.type', 'emoji'] },
                                        { $ne: ['$$contentConfig.block.properties.icon.emoji', ''] },
                                      ]
                                    },
                                    then: {
                                      $concat: [
                                        '$$contentConfig.block.properties.icon.emoji',
                                        ' ',
                                        '$$contentConfig.block.properties.text'
                                      ]
                                    },
                                    else: '$$contentConfig.block.properties.text',
                                  }
                                },
                                '](https://volt.link/',
                                '$$contentConfig.block.properties.slug',
                                ')'
                              ]
                            },
                          },
                          {
                            case: { $eq: ['$$contentConfig.block.properties.coverphoto.type', 'url'] },
                            then: {
                              $concat: [
                                '[',
                                {
                                  $cond: {
                                    if: {
                                      $and: [
                                        { $eq: ['$$contentConfig.block.properties.icon.type', 'emoji'] },
                                        { $ne: ['$$contentConfig.block.properties.icon.emoji', ''] },
                                      ]
                                    },
                                    then: {
                                      $concat: [
                                        '$$contentConfig.block.properties.icon.emoji',
                                        ' ',
                                        '$$contentConfig.block.properties.text'
                                      ]
                                    },
                                    else: '$$contentConfig.block.properties.text',
                                  }
                                },
                                '](https://volt.link/',
                                { $toString: '$$contentConfig.block._id' },
                                ')'
                              ]
                            },
                          }
                        ],
                        default: ''
                      }
                    }
                  },
                  {
                    case: { $eq: ['$$contentConfig.block.type', 'image'] },
                    then: {
                      $switch: {
                        branches: [
                          {
                            case: { $eq: ['$$contentConfig.block.properties.coverphoto.type', 'url'] },
                            then: { $concat: ['![', '$$contentConfig.block.properties.text', '](', '$$contentConfig.block.properties.coverphoto.url', ')'] },
                          },
                          {
                            case: { $eq: ['$$contentConfig.block.properties.coverphoto.type', 'file'] },
                            then: { $concat: ['![', '$$contentConfig.block.properties.text', '](https://storage.volt.link/', '$$contentConfig.block.properties.coverphoto.fileId', ')'] },
                          },
                        ],
                        default: ''
                      }
                    }
                  },
                  {
                    case: { $eq: ['$$contentConfig.block.type', 'code'] },
                    then: { $concat: ['```\n', '$$contentConfig.block.properties.text', '\n```'] },
                  }
                ],
                default: ''
              }
            }
          }
        }
      }
    }
  },
  {
    $set: {
      'root.computed.contentAsPlaintext': {
        $reduce: {
          input: '$root.computed.contentAsPlaintextPerBlock',
          initialValue: '',
          in: {
            $concat: [
              '$$value',
              { $cond: [{ $eq: ['$$value', ''] }, '', '\n'] },
              '$$this'
            ]
          }
        }
      },
      'root.computed.contentAsMarkdown': {
        $reduce: {
          input: '$root.computed.contentAsMarkdownPerBlock',
          initialValue: '',
          in: {
            $concat: [
              '$$value',
              { $cond: [{ $eq: ['$$value', ''] }, '', '\n'] },
              '$$this'
            ]
          }
        }
      },
    }
  },
  {
    $set: {
      'root.computed.contentAsPlaintextPerBlock': {
        $filter: {
          input: '$root.computed.contentAsPlaintextPerBlock',
          as: 'c',
          cond: { $ne: ['$$c', null] }
        }
      },
      'root.computed.contentAsMarkdownPerBlock': {
        $filter: {
          input: '$root.computed.contentAsMarkdownPerBlock',
          as: 'c',
          cond: { $ne: ['$$c', null] }
        }
      },
      'root.computed.contentAsPlaintext': { $ifNull: ['$root.computed.contentAsPlaintext', ''] },
      'root.computed.contentAsMarkdown': { $ifNull: ['$root.computed.contentAsMarkdown', ''] },
    }
  },
  // END convert content to markdown and plaintext



  { $replaceRoot: { newRoot: '$root' } },
])
