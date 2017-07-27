'use strict';

const crypto = require('crypto');
const F = require('./util/functions');
const McpNegotiate = require('./mcp-packages/mcp-negotiate');

const OUT_OF_BAND_PREFIX = '#$#';
const QUOTE_PREFIX = '#$"';
const RESERVED_PREFIXES = [OUT_OF_BAND_PREFIX, QUOTE_PREFIX];
const DATA_TAG_KEY = '_data-tag';

const SUPPORTED_VERSION = '2.1';
const SUPPORTED_PACKAGES = [McpNegotiate];

// http://www.moo.mud.org/mcp/mcp2.html
function MCP({send, enabledPackages = []}) {
  this.rawSend = send;
  this.authKey = null;
  this.multilineMessages = {};
  this.packages = {};

  var supportedPackagesMap = new Map(
    SUPPORTED_PACKAGES.map(cFunc =>
      ([cFunc.prototype.packageName, cFunc])));

  var allEnabledPackages = [{
    name: 'mcp-negotiate',
    args: {
      packages: ['mcp-negotiate', ...enabledPackages.map(pkg => pkg.name)]
    }
  }, ...enabledPackages];

  for (let enabledPackage of allEnabledPackages) {
    let packageConstructor = supportedPackagesMap.get(enabledPackage.name);
    let mergedArgs = F.merge(enabledPackage.args, {
      send: MCP.prototype._sendMessage.bind(this)
    });
    this.packages[enabledPackage.name] = new packageConstructor(mergedArgs);
  }
}

MCP.prototype.filterIncoming = function(line) {
  if (line.startsWith(OUT_OF_BAND_PREFIX)) {
    this._handleOutOfBandLine(line.substr(OUT_OF_BAND_PREFIX.length));
    return null;
  }
  if (line.startsWith(QUOTE_PREFIX)) {
    return line.substr(QUOTE_PREFIX.length);
  }
  return line;
};

MCP.prototype.filterOutgoing = function(line) {
  return RESERVED_PREFIXES.some(prefix => line.startsWith(prefix)) ?
    QUOTE_PREFIX + line :
    line;
};

MCP.prototype._handleOutOfBandLine = function(line) {
  var name = line.split(' ')[0];

  try {
    if (name == 'mcp') {
      this._startup(line);
    } else if (name == '*') {
      this._handleMessageContinue(line);
    } else if (name == ':') {
      this._handleMessageEnd(line);
    } else {
      this._handleMessageStart(line);
    }
  } catch (error) {
    console.error('Error handling out of band line:', error.message);
    console.error(line);
  }
};

MCP.prototype._startup = function(line) {
  var {/* leadingTokens: [nameToken], */ restString} = extractTokens(line, 1);
  var keyVals = parseKeyVals(restString);
  if (!keyVals.version || !keyVals.to) {
    throw Error('Missing version info');
  }
  if (compareVersions(keyVals.to, SUPPORTED_VERSION) < 0) {
    throw Error('Server version too low');
  } if (compareVersions(SUPPORTED_VERSION, keyVals.version) < 0) {
    throw Error('Server version too high');
  }
  this._generateAuthKey();
  this._sendMessage('mcp', {
    'authentication-key': this.authKey,
    version: SUPPORTED_VERSION,
    to: SUPPORTED_VERSION
  });
  return this.packages['mcp-negotiate'].enable();
};

MCP.prototype._generateAuthKey = function() {
  this.authKey = generateKey(4);
};

MCP.prototype._handleMessageStart = function(line) {
  var {leadingTokens: [nameToken, authKey], restString} = extractTokens(line, 2);
  var name = nameToken.toLowerCase();

  if (authKey != this.authKey) {
    throw Error(`Incorrect authentication key: ${authKey}`);
  }

  var keyVals = parseKeyVals(restString);
  var hasMultiline = Object.values(keyVals).some(val => val instanceof Array);
  if (hasMultiline) {
    var dataTag = keyVals[DATA_TAG_KEY];
    if (!dataTag) {
      throw Error('Missing data tag for multiline message');
    }
    if (this.multilineMessages[dataTag]) {
      throw Error(`Data tag '${dataTag}' already in use`);
    }
    this.multilineMessages[dataTag] = {name, keyVals};
  } else {
    this._processMessage(name, keyVals);
  }
};

MCP.prototype._handleMessageContinue = function(line) {
  var {leadingTokens: [
    /* name */, dataTag, keywordToken], restString} = extractTokens(line, 3);
  var message = this.multilineMessages[dataTag];
  if (!message) {
    throw Error(`No multiline message with data tag '${dataTag}'`);
  }
  var parsed = parseKeyword(keywordToken);
  if (!parsed) {
    throw Error('No keyword in multiline continuation message');
  } else if (!message.keyVals[parsed.keyword]) {
    throw Error(`Unknown keyword '${parsed.keyword}'`);
  } else if (!(message.keyVals[parsed.keyword] instanceof Array)) {
    throw Error(`Non-multiline keyword '${parsed.keyword}'`);
  }
  message.keyVals[parsed.keyword].push(restString);
};

MCP.prototype._handleMessageEnd = function(line) {
  var {leadingTokens: [/* name */, dataTag]} = extractTokens(line, 2);
  var message = this.multilineMessages[dataTag];
  if (!message) {
    throw Error(`No multiline message with data tag '${dataTag}'`);
  }
  this.multilineMessages[dataTag] = null;
  this._processMessage(message.name, message.keyVals);
};

// eslint-disable-next-line no-unused-vars
MCP.prototype._processMessage = function(name, keyVals) {
  // TODO
};

MCP.prototype._sendMessage = function(name, keyVals) {
  var multiline = Object.values(keyVals)
    .some(val => val instanceof Array);

  if (multiline) {
    // TODO
    throw Error('Multiline currently unsupported');
  }

  // let keyValsString = '';
  // for (let [key, val] of Object.entries(keyVal)) {
  //   let requireQuoting = val.match(/[ "\\:*]/);
  //   if (requireQuoting) {
  //     keyValsString += 
  //   }
  // }

  var keyValsString = Object.entries(keyVals)
    .map(([key, val]) => {
      let requireQuoting = val.match(/[ "\\:*]/);
      if (requireQuoting) {
        return `${key}: ${quote(val)}`;
      }
        return `${key}: ${val}`;
    })
    .join(' ');

  this.rawSend(`${name} ${this.authKey} ${keyValsString}`);
};

function compareVersions(v1, v2) {
  var parsed1 = parseVersion(v1);
  var parsed2 = parseVersion(v2);
  if (!parsed1 || !parsed2) {
    return null;
  }
  var compareNumbers = (a, b) => a - b;
  if (parsed1.major === parsed2.major) {
    return compareNumbers(parsed1.minor, parsed2.minor);
  }
  return compareNumbers(parsed1.major, parsed2.major);
}

function parseVersion(versionString) {
  if (!parseFloat(versionString)) {
    return null;
  }
  var [major, minor] = versionString.split('.')
    .map(val => parseInt(val, 10));
  return {major, minor};
}

function generateKey(size) {
  var buffer = crypto.randomBytes(size);
  return buffer.toString('hex');
}

function extractTokens(line, count) {
  var tokens = line.split(' ');
  var leadingTokens = [];
  for (let i=0; i<tokens.length; i++) {
    if (!tokens[i]) { continue; }
    leadingTokens.push(tokens[i]);
    if (leadingTokens.length >= count) {
      return {
        leadingTokens,
        restString: tokens.slice(i+1).join(' ')
      };
    }
  }
  return {leadingTokens, restString: ''};
}

function parseKeyVals(line) {
  var keyVals = {};
  var currentKeyword = null;
  var quoted = false;

  var tokens = line.split(' ');
  for (let token of tokens) {
    if (!token && !quoted) { continue; }

    if (!currentKeyword) {
      // Keyword token
      let parsed = parseKeyword(token);
      if (!parsed) {
        throw Error(`Invalid keyword token '${token}'`);
      }
      if (keyVals.hasOwnProperty(parsed.keyword)) {
        throw Error(`Duplicated keyword '${parsed.keyword}'`);
      }
      currentKeyword = parsed.keyword;
      keyVals[currentKeyword] = parsed.multiline ? [] : '';

    } else {
      // Value token
      let parsed = token;
      let isOpeningQuote = false;
      let isClosingQuote = false;
      if (!quoted && parsed.startsWith('"')) {
        isOpeningQuote = true;
        quoted = true;
        parsed = parsed.slice(1);
      }
      if (quoted) {
        isClosingQuote = parsed.replace(/\\["\\]/g, '').endsWith('"');
        if (isClosingQuote) {
          parsed = parsed.slice(0, -1);
        }
        parsed = parseQuotedValue(parsed);
      } else {
        parsed = parseUnquotedValue(parsed);
      }
      // Value for a multiline key should be ignored according to spec
      if (typeof keyVals[currentKeyword] == 'string') {
        if (isOpeningQuote || (!quoted && !keyVals[currentKeyword])) {
          keyVals[currentKeyword] += parsed;
        } else {
          keyVals[currentKeyword] += ' ' + parsed;
        }
      }
      if (isClosingQuote || !quoted) {
        quoted = false;
        currentKeyword = null;
      }
    }
  }

  if (quoted) {
    throw Error('Unclosed quote');
  } else if (currentKeyword) {
    throw Error(`Missing value for keyword '${currentKeyword}'`);
  }

  return keyVals;
}

function parseQuotedValue(token) {
  // Parse the value between quotation marks by
  // checking for rogue \ and unescaping \" and \\
  var escapesRegExp = /\\("|\\)/g;
  var hasRogue = token.replace(escapesRegExp, '').match(/["\\]/);
  if (hasRogue) {
    throw Error('Unescaped quote or backslash within quoted value');
  }
  return token.replace(escapesRegExp, (_, p) => p);
}

function parseUnquotedValue(token) {
  if (token.match(/["\\:*]/)) {
    throw Error('Invalid characters in unquoted value');
  }
  return token;
}

function parseKeyword(keyToken) {
  var match = /^([a-zA-Z_][a-zA-Z_0-9-]+)(\*)?:$/.exec(keyToken);
  if (!match) {
    return null;
  }
  return {
    keyword: match[1].toLowerCase(),
    multiline: match[2] ? true : false
  };
}

module.exports = MCP;
