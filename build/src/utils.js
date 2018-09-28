'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

// error util
var throwError = exports.throwError = function throwError(message, index) {
  var error = new Error(message + ' at character ' + index);
  error.index = index;
  error.description = message;
  throw error;
};

// Get return the longest key length of any object
var getMaxKeyLen = exports.getMaxKeyLen = function getMaxKeyLen(obj) {
  var max_len = 0,
      len;
  for (var key in obj) {
    if ((len = key.length) > max_len && obj.hasOwnProperty(key)) {
      max_len = len;
    }
  }
  return max_len;
};