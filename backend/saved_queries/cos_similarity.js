// http://demo.clab.cs.cmu.edu/NLP/S21/files/slides/17-embeddings.pdf

db.getCollection('test').aggregate([
  {
    $set: {
      index: { $range: [0, { $size: "$source" }] },
    }
  },
  {
    $set: {
      source_val: {
        $sqrt: {
          $reduce: {
            input: '$index',
            initialValue: 0,
            in: { $add: ["$$value", { $pow: [{ $arrayElemAt: ["$source", "$$this"] }, 2] }] }
          }
        }
      },
      sink_val: {
        $sqrt: {
          $reduce: {
            input: '$index',
            initialValue: 0,
            in: { $add: ["$$value", { $pow: [{ $arrayElemAt: ["$sink", "$$this"] }, 2] }] }
          }
        }
      },
      dotProduct: {
        $reduce: {
          input: '$index',
          initialValue: 0,
          in: { $add: ["$$value", { $multiply: [{ $arrayElemAt: ["$source", "$$this"] }, { $arrayElemAt: ["$sink", "$$this"] }] }] }
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
              '$source_val',
              '$sink_val'
            ]
          }
        ]
      }
    }
  }
])
