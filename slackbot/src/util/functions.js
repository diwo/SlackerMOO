'use strict';

const R = require('ramda');

var functions = {
  toMap: function(arr, valFunc) {
    return R.zipObj(arr, arr.map(valFunc));
  },
  merge: R.merge
};

module.exports = functions;
