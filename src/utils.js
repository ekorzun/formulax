
// error util
export const throwError = (message, index) => {
  var error = new Error(message + ' at character ' + index)
  error.index = index
  error.description = message
  throw error
}

// Get return the longest key length of any object
export const getMaxKeyLen = (obj) => {
  var max_len = 0, len
  for (var key in obj) {
    if ((len = key.length) > max_len && obj.hasOwnProperty(key)) {
      max_len = len
    }
  }
  return max_len
}