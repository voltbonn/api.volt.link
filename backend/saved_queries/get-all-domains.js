db.getCollection('blocks').aggregate([
  { $match: { type: 'website' } },
  {
    $project: {
      url: {
        $concatArrays: [
          [{
            url: '$properties.url'
          }],
          "$properties.linked_websites"
        ]
      },
    }
  },
  {
    $unwind: {
      path: '$url',
      preserveNullAndEmptyArrays: true,
    }
  },
  {
    $match: {
      'url.url': { $exists: true, $type: 'string', $ne: '' }
    }
  },
  {
    $group: {
      _id: '$url.url',
      url: { $first: '$url.url' },
    }
  },
  {
    $addFields: {
      domain: {
        $function: {
          body: function (url) {
            // // source: https://stackoverflow.com/questions/34818020/javascript-regex-url-extract-domain-only
            // var result
            // var match
            // if (match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n\?\=]+)/im)) {
            //   result = match[1]
            //   if (match = result.match(/^[^\.]+\.(.+\..+)$/)) {
            //     result = match[1]
            //   }
            // }

            // // source: https://stackoverflow.com/a/46345646/2387277
            // var result
            // var match
            // if (match = url.match(/[A-Za-z0-9](?:(?:[-A-Za-z0-9]){0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:(?:[-A-Za-z0-9]){0,61}[A-Za-z0-9])?){1,}/giu)) {
            //   result = match[0]
            // }
            // return result

            // source: https://regex101.com/r/ZUHk60/3
            var result
            var match
            if (match = url.match(/(?:https?:\/\/)?(?:www.)?instagram.com\/?([a-zA-Z0-9\.\_\-]+)?\/([p]+)?([reel]+)?([tv]+)?([stories]+)?\/([a-zA-Z0-9\-\_\.]+)\/?([0-9]+)?/gi)) {
              result = match[1] || match[6]
            }
            return result

          },
          args: ["$url"],
          lang: "js"
        }
      }
    }
  },
  {
    $group: {
      _id: '$domain',
      amount: { $sum: 1 },
      urls: { $addToSet: '$url' },
    }
  },
  {
    $sort: {
      amount: -1,
      _id: 1,
    }
  }
])
