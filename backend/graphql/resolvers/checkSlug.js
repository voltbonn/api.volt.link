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

  return {
    isOkay: errors.length === 0,
		errors,
  }
}
