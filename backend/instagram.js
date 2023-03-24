const fs = require('fs')
const fetch = require('node-fetch') // require needs version 2

const cache_folder = './cache/'

const special_user_agent = 'Instagram 219.0.0.12.117 Android'
// const special_user_agent = 'Mozilla/5.0 (Linux; Android 9; GM1903 Build/PKQ1.190110.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/75.0.3770.143 Mobile Safari/537.36 Instagram 103.1.0.15.119 Android (28/9; 420dpi; 1080x2260; OnePlus; GM1903; OnePlus7; qcom; sv_SE; 164094539)'

async function load_insta_posts_option_1 (user_profile_id, count) {
  const url = `https://www.instagram.com/graphql/query/?query_id=17888483320059182&variables={"id":"${user_profile_id}","first":${count},"after":null}`

  console.log('url', url)

  // fetch posts but use a special the user agent
  const response = await fetch(url, {
    headers: {
      'User-Agent': special_user_agent,
    },
  })
  let posts = await response.json()

  console.log('posts', posts)

  posts = posts?.data?.user?.edge_owner_to_timeline_media?.edges

  posts = posts.map(post => {
    post = post.node

    let caption = ''
    try {
      caption = post?.edge_media_to_caption?.edges[0]?.node?.text || ''
    } catch (error) {
      console.error(error)
    }

    return {
      id: post.id,
      found_timestamp: new Date().getTime(),
      shortcode: post.shortcode,
      caption: caption,
      timestamp: post.taken_at_timestamp,
      is_video: post.is_video,
      width: post.dimensions.width,
      height: post.dimensions.height,
      image_url: post.thumbnail_src || post.display_url,
      user: {
        id: post.owner.id,
        // username: post.user.username,
        // full_name: post.user.full_name,
        // profile_pic_url: post.user.profile_pic_url,
      }
    }
  })

  return posts
}

async function load_insta_posts_option_2(user_name, count) {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${user_name}`

  // fetch posts but use a special the user agent
  const response = await fetch(url, {
    headers: {
      'User-Agent': special_user_agent,
    },
  })

  let posts = await response.json()
  posts = posts.data.user.edge_owner_to_timeline_media.edges

  if (posts.length > count) {
    posts = posts.slice(0, count)
  }

  posts = posts.map(post => {
    post = post.node

    return {
      id: post.id,
      found_timestamp: new Date().getTime(),
      shortcode: post.shortcode,
      caption: post.edge_media_to_caption.edges[0].node.text,
      timestamp: post.taken_at_timestamp,
      is_video: post.is_video,
      width: post.dimensions.width,
      height: post.dimensions.height,
      image_url: post.display_url || post.thumbnail_src,
      user: {
        id: post.owner.id,
        // username: post.user.username,
        // full_name: post.user.full_name,
        // profile_pic_url: post.user.profile_pic_url,
      }
    }
  })

  return posts
}

async function load_insta_posts_option_3(user_name, count) {
  const url = `https://www.instagram.com/api/v1/feed/user/${user_name}/?count=${count}`

  // fetch posts but use a special the user agent
  const response = await fetch(url, {
    headers: {
      'User-Agent': special_user_agent,
    },
  })


  let posts = await response.json()
  posts = posts.items

  posts = posts.map(post => {

    // START GET THE IMAGE
    let image_url = null
    let image_versions2 = []

    if (post?.carousel_media) {
      image_versions2 = post?.carousel_media[0]?.image_versions2?.candidates || []
    } else if (post?.image_versions2) {
      image_versions2 = post?.image_versions2?.candidates || []
    }

    if (image_versions2.length > 0) {
      image_url = image_versions2
        .sort((a, b) => b.width - a.width)[0].url
    }
    // END GET THE IMAGE

    let caption = ''
    if (post?.caption?.text) {
      caption = post?.caption?.text
    }

    return {
      id: post.id,
      found_timestamp: new Date().getTime(),
      shortcode: post.code,
      caption: caption,
      timestamp: post.taken_at,
      is_video: post.media_type === 2,
      width: post.original_width,
      height: post.original_height,
      image_url: image_url,
      user: {
        id: post.user.pk_id,
        // username: post.user.username,
        // full_name: post.user.full_name,
        // profile_pic_url: post.user.profile_pic_url,
      }
    }
  })

  return posts
}

async function load_remote_insta_posts(user_profile_id, user_name, count) {
  posts = []
  try {
    // posts = await load_insta_posts_option_1(user_profile_id, count)
    // posts = await load_insta_posts_option_2(user_name, count)
    posts = await load_insta_posts_option_3(user_profile_id, count)
  } catch (error) {
    console.error(error)
  }

  if (!Array.isArray(posts)) {
    posts = []
  }

  return posts
}

function get_cache_file_path(user_profile_id, user_name) {
  return `${cache_folder}insta_posts_${user_name}_${user_profile_id}.json`
}

function get_cached_insta_posts(user_profile_id, user_name) {

  const cache_file_path = get_cache_file_path(user_profile_id, user_name)

  // check if cache folder exists
  if (!fs.existsSync(cache_file_path)) {
    return []
  }

  // save cache-file
  let posts = fs.readFileSync(cache_file_path, 'utf8')
  posts = JSON.parse(posts)
  posts = posts.posts

  return posts
}

function load_insta_posts(user_profile_id, user_name, count) {
  return new Promise(async resolve => {
    function callback(posts) {
      if (posts.length > count) {
        posts = posts.slice(0, count)
      }
      resolve(posts)
    }

    const cached_posts = await get_cached_insta_posts(user_profile_id, user_name)

    const posts_to_return = cached_posts
      .map(post => ({
        ...post,
        link: `https://www.instagram.com/p/${post.shortcode}`,
      }))

    callback(posts_to_return)


    // load new posts in background
    const new_posts = await load_remote_insta_posts('55472423271', 'voltpotsdam', count)
      .catch(console.error)

    // cache new posts
    const combined_posts = [
      ...(
        cached_posts
        // remove duplicates by id-property (this replaces updated posts)
        .filter(post => new_posts.findIndex(p => p.id === post.id) === -1)
      ),
      ...new_posts,
    ]
      .sort((a, b) => b.timestamp - a.timestamp) // newest first

    // check if cache folder exists
    if (!fs.existsSync(cache_folder)) {
      fs.mkdirSync(cache_folder)
    }

    // save cache-file
    fs.writeFileSync(
      get_cache_file_path(user_profile_id, user_name),
      JSON.stringify({ posts: combined_posts }, null, 2)
    )
  })
}

module.exports = {
  load_insta_posts,
}


/*

http://localhost:4004/instagram_posts.json?username=voltbrandenburg&userid=44732153616&count=1

https://api.volt.link/instagram_posts.json?username=voltbrandenburg&userid=44732153616&count=1

Example Insta Accounts:

username = voltpotsdam
userid = 55472423271

username = voltbrandenburg
userid = 44732153616

*/

/*

# Instagram Post Public API




## To get a list of post in a profile:


### Option 1:
No idea why this works. But it doesn’t need a login.
first can be up to 50 posts.

https://www.instagram.com/graphql/query/?query_id=17888483320059182&variables={"id”:”USER_PROFILE_ID,”first":3,"after":null}


### Option 2:
No idea why this works. But it doesn’t need a login. Only a user_agent hack.

https://www.instagram.com/api/v1/users/web_profile_info/?username=voltpotsdam

This needs the user_agent to be set to one of the following:

Instagram 219.0.0.12.117 Android

source: https://github.com/postaddictme/instagram-php-scraper/issues/544

OR

Mozilla/5.0 (Linux; Android 9; GM1903 Build/PKQ1.190110.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/75.0.3770.143 Mobile Safari/537.36 Instagram 103.1.0.15.119 Android (28/9; 420dpi; 1080x2260; OnePlus; GM1903; OnePlus7; qcom; sv_SE; 164094539)

source: https://stackoverflow.com/questions/48662940/cant-get-instagram-profile-picture-full-size


### Option 3:
COUNT can be up to 33 posts.
Needs the user agent hack from option 2.

https://www.instagram.com/api/v1/feed/user/USER_PROFILE_ID/?count=COUNT




## To get post by hashtag:

No idea why this works. But it doesn’t need a login. Only a user_agent hack.

https://www.instagram.com/graphql/query/?query_hash=3e7706b09c6184d5eafd8b032dbcf487&variables={"tag_name":"USERNAME","first":25,"after":""}




## To get the user info:

No idea why this works. But it doesn’t need a login. Only a user_agent hack.

https://i.instagram.com/api/v1/users/8053633082/info/




## To search for user profiles:

https://www.instagram.com/web/search/topsearch/?context=blended&query=USERNAME

https://api.instagram.com/v1/users/search?q=[USERNAME]&client_id=[CLIENT ID]


*/
