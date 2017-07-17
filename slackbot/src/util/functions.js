'use strict';

const R = require('ramda');

var functions = {
  toMap: function(arr, valFunc) {
    return R.zipObj(arr, arr.map(valFunc));
  }
};

module.exports = functions;
