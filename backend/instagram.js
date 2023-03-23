/*

Instagram Post Public API



To get a list of post in a profile:

Option 1:
No idea why this works. But it doesn’t need a login.
first can be up to 50 posts.

https://www.instagram.com/graphql/query/?query_id=17888483320059182&variables={"id”:”USER_PROFILE_ID,”first":3,"after":null}


Option 2:
No idea why this works. But it doesn’t need a login. Only a user_agent hack.

https://www.instagram.com/api/v1/users/web_profile_info/?username=voltpotsdam

This needs the user_agent to be set to one of the following:

Instagram 219.0.0.12.117 Android

source: https://github.com/postaddictme/instagram-php-scraper/issues/544

OR

Mozilla/5.0 (Linux; Android 9; GM1903 Build/PKQ1.190110.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/75.0.3770.143 Mobile Safari/537.36 Instagram 103.1.0.15.119 Android (28/9; 420dpi; 1080x2260; OnePlus; GM1903; OnePlus7; qcom; sv_SE; 164094539)

source: https://stackoverflow.com/questions/48662940/cant-get-instagram-profile-picture-full-size


Option 3:
COUNT can be up to 33 posts.
Needs the user agent hack from option 2.

https://www.instagram.com/api/v1/feed/user/USER_PROFILE_ID/?count=COUNT



Option 4 ???:

To get post by hashtag:

No idea why this works. But it doesn’t need a login. Only a user_agent hack.

https://www.instagram.com/graphql/query/?query_hash=3e7706b09c6184d5eafd8b032dbcf487&variables={"tag_name":"USERNAME","first":25,"after":""}





To search for user profiles:

https://www.instagram.com/web/search/topsearch/?context=blended&query=USERNAME

https://api.instagram.com/v1/users/search?q=[USERNAME]&client_id=[CLIENT ID]


*/
