'use strict';

function McpPackage({send}) {
  if (!this.packageName) {
    throw Error(`Missing packageName for package '${constructor.name}'`);
  } else if (!this.version || !this.version.min || !this.version.max) {
    throw Error(`Missing version for package '${constructor.name}'`);
  } else if (!this.init) {
    throw Error(`Missing init for package '${constructor.name}'`);
  }

  this.mcpSend = send;
  this.enabled = false;
}

McpPackage.prototype.enable = function() {
  if (!this.enabled) {
    this.enabled = true;
    this.init();
  }
};

McpPackage.prototype.send = function(messageName, keyVals) {
  this.mcpSend([this.packageName, messageName].join('-'), keyVals);
};

module.exports = McpPackage;
