db.getCollection('phrases').aggregate([
  {
    $match: {
      phrase: 'How old are u?'
    }
  },

  {
    $lookup: {
      from: 'phrases',
      as: 'similar_phrases',
      let: {
        input_phrase: '$phrase',
        index: {
          $range: [
            0,
            {
              $size: '$embedding'
            }
          ]
        },
        inputVector: '$embedding'
      },
      pipeline: [
        {
          $set: {
            embedding_val: {
              $sqrt: {
                $reduce: {
                  input: '$$index',
                  initialValue: 0,
                  in: {
                    $add: [
                      '$$value',
                      {
                        $pow: [
                          {
                            $arrayElemAt: [
                              '$embedding',
                              '$$this'
                            ]
                          },
                          2
                        ]
                      }
                    ]
                  }
                }
              }
            },
            inputVector_val: {
              $sqrt: {
                $reduce: {
                  input: '$$index',
                  initialValue: 0,
                  in: {
                    $add: [
                      '$$value',
                      {
                        $pow: [
                          {
                            $arrayElemAt: [
                              '$$inputVector',
                              '$$this'
                            ]
                          },
                          2
                        ]
                      }
                    ]
                  }
                }
              }
            },
            dotProduct: {
              $reduce: {
                input: '$$index',
                initialValue: 0,
                in: {
                  $add: [
                    '$$value',
                    {
                      $multiply: [
                        {
                          $arrayElemAt: [
                            '$embedding',
                            '$$this'
                          ]
                        },
                        {
                          $arrayElemAt: [
                            '$$inputVector',
                            '$$this'
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            }
          }
        },
        {
          $set: {
            dotProduct: {
              $divide: [
                '$dotProduct',
                {
                  $multiply: [
                    '$embedding_val',
                    '$inputVector_val'
                  ]
                }
              ]
            }
          }
        },
        {
          $unset: [
            'index',
            'inputVector',
            'embedding',
            'inputVector_val',
            'embedding_val',
            // 'dotProduct'
          ]
        },
        {
          $match: {
            dotProduct: { $ne: 1.0 },
          }
        },
        {
          $sort: {
            dotProduct: -1,
          }
        },
        {
          $limit: 1
        }

      ],
    }
  },
  {
    $set: {
      similar_phrases: { $first: '$similar_phrases' }
    }
  },

  { $unset: ['embedding'] }
])
