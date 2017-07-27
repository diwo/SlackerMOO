'use strict';

const McpPackage = require('../mcp-package');

function McpNegotiate(args) {
  McpPackage.call(this, args);
}
McpNegotiate.prototype = Object.create(McpPackage.prototype);
McpNegotiate.prototype.constructor = McpNegotiate;

McpNegotiate.prototype.packageName = 'mcp-negotiate';
McpNegotiate.prototype.version = { min: '1.0', max: '2.0' };

McpNegotiate.prototype.init = function() {
  this.send('can', {});
};

module.exports = McpNegotiate;
