const isDevEnvironment = process.env.environment === 'dev' || false

const stream = require('stream')
const AWS = require('aws-sdk')

const bucketName = 'volt.link'
const s3 = new AWS.S3({
  endpoint: 'https://s3.eu-central-1.amazonaws.com/',
  accessKeyId: process.env.s3_access_key_id,
  secretAccessKey: process.env.s3_secret_access_key,
  accessSecretKey: process.env.s3_secret_access_key,
  region: 'eu-central-1',
  sslEnabled: false,
  s3ForcePathStyle: true,
})

const createUploadStream = (key) => {
  const pass = new stream.PassThrough()
  return {
    writeStream: pass,
    promise: s3
      .upload({
        Bucket: bucketName,
        Key: key,
        Body: pass,
      })
      .promise()
  }
}

module.exports = async (parent, args, context, info) => {
  const mongodb = context.mongodb
  const user = context.user

  if (!context.logged_in) {
    throw new Error('Not logged in.')
  } else {
    const file = args.file
    const newFileId = new mongodb.ObjectID()
    console.log('newFileId-A', newFileId)

    try {
      const { filename, createReadStream } = await file

      const key_name = (
        isDevEnvironment
          ? `dev_files/${String(newFileId)}`
          : `files/${String(newFileId)}` // Use the files prefix to also store other stuff in the bucket.
      )

      console.log('key_name', key_name)

      const uploadStream = createUploadStream(key_name)
      const stream = createReadStream()
      stream.pipe(uploadStream.writeStream)

      // TODO add previews to "thumbnails/"

      const uploadResult = await uploadStream.promise

      const newBlock = {
        _id: newFileId,
        type: 'file',
        properties: {
          name: filename,
          aws_s3: uploadResult,
        },
        metadata: {
          modified_by: user.email,
          modified: new Date(),
        },
        permissions: {
          '/': [
            {
              email: context.user.email,
              role: 'owner',
            }, {
              email: '@volteuropa.org',
              role: 'viewer',
            }, {
              email: '@public',
              role: 'viewer',
            }
          ],
        }
      }


      console.log('newBlock', JSON.stringify(newBlock,null,2))

      const insertResult = await mongodb.collections.blocks
        .insertOne(newBlock)

      console.log('insertResult', JSON.stringify(insertResult, null, 2))

      if (insertResult.acknowledged === true) {
        console.log('newFileId-B', newFileId)
        return newFileId // return the id of the new block (newFileId should be the same as insertResult.insertedId)
      } else {
        throw new Error('Error inserting block for file.')
      }
    } catch (error) {
      console.error('Error uploading file', error)
      throw new Error('Error uploading file', error)
    }
  }
}
