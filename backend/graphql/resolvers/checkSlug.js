const forbiddenInSlug = {
  codes: `
undefined
null
error
public
auth
auth/google
auth/google/callback
auth/failure
logout
user.json
login
pull
exists
get
set
list
`
    .split('\n')
    .filter(Boolean),
  letters: ' /\\\'"´`(){}[]<>,;:?!¿¡=#+|~^°',
  special_letters: '.'
}

module.exports = async (parent, args, context, info) => {
  const mongodb = context.mongodb

  const slug = args.slug
  const slug_split = slug.split('')

  const errors = []

  const forbidden_letters_splitted = forbiddenInSlug.letters.split('')

  if (slug.includes('/')) {
    errors.push(`Cant't contain a slash (/).`)
  }

  if (slug.startsWith('volt')) {
    errors.push(`Cant't start with "volt".`)
  }

  if (forbiddenInSlug.codes.includes(slug)) {
    errors.push(`Can't be a forbidden slug.`)
  }

  if (forbidden_letters_splitted.filter(value => !slug_split.includes(value)).length < forbidden_letters_splitted.length) {
    errors.push(`Can't contain one or more of these forbidden letter: ${forbidden_letters_splitted.join(' ')}`)
  }

  if (mongodb.ObjectId.isValid(slug)) {
    errors.push(`Cant't be a mongoID. Just make it one letter longer.`)
  }

  let existsAsSlug = false
  let existsAsId = false

  const findBySlugResult = await mongodb.collections.blocks.findOne({
    'properties.slug': slug,
    // don't check for permissions
  })
  if (findBySlugResult !== null && findBySlugResult.hasOwnProperty('_id')) {
    existsAsSlug = true
    // Don't send error message, as this is also true if only one block with this slug exists.
  }

  const findByIdResult = await mongodb.collections.blocks.findOne({
    _id: slug,
    // don't check for permissions
  })
  if (findByIdResult !== null && findByIdResult.hasOwnProperty('_id')) {
    existsAsId = true
    errors.push(`There is already an id with this slug. Please add or remove a letter.`)
  }

  return {
    isOkay: errors.length === 0,
    existsAsSlug,
    existsAsId,
		errors,
  }
}
