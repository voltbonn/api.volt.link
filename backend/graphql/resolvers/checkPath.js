const forbiddenInPath = {
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

  const path = args.path
  const path_split = path.split('')

  const errors = []

  const forbidden_letters_splitted = forbiddenInPath.letters.split('')

  if (path.includes('/')) {
    errors.push(`Cant't contain a slash (/).`)
  }

  if (path.startsWith('volt')) {
    errors.push(`Cant't start with "volt".`)
  }

  if (forbiddenInPath.codes.includes(path)) {
    errors.push(`Can't be a forbidden path.`)
  }

  if (forbidden_letters_splitted.filter(value => !path_split.includes(value)).length < forbidden_letters_splitted.length) {
    errors.push(`Can't contain one or more of these forbidden letter: ${forbidden_letters_splitted.join(' ')}`)
  }

  if (mongodb.ObjectId.isValid(path)) {
    errors.push(`Cant't be a mongoID. Just make it one letter longer.`)
  }

  return {
    isOkay: errors.length === 0,
		errors,
  }
}
