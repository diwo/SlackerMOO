const assert = require('chai').assert;
const MCP = require('../src/mcp');

describe('MCP', () => {
  describe('filterIncoming', () => {
    var instance, execution;

    beforeEach(() => {
      execution = {};
      instance = {
        _handleOutOfBandLine: function(line) {
          execution['_handleOutOfBandLine'] = {line};
        }
      };
    });

    it('handles out-of-band lines', () => {
      var oobMessage = 'Some data in an out-of-band message';
      var oobLine = `#$#${oobMessage}`;
      var filtered = MCP.prototype.filterIncoming.call(instance, oobLine);
      assert.isNull(filtered);
      assert.equal(execution['_handleOutOfBandLine'].line, oobMessage);
    });

    it('lets in-band lines through unmodified', () => {
      var inBandLine = 'Some message meant to be sent in-band';
      var filtered = MCP.prototype.filterIncoming.call(instance, inBandLine);
      assert.equal(filtered, inBandLine);
      assert.isNotOk(execution['_handleOutOfBandLine']);
    });

    it('removes escaped prefix and lets rest of the message through', () => {
      var inBandMessage = '#$#Some message meant to be sent in-band';
      var escapedLine = `#$"${inBandMessage}`;
      var filtered = MCP.prototype.filterIncoming.call(instance, escapedLine);
      assert.equal(filtered, inBandMessage);
      assert.isNotOk(execution['_handleOutOfBandLine']);
    });
  });

  describe('filterOutgoing', () => {
    it('escapes out-of-band prefix', () => {
      var inBandMessage = '#$#Some message meant to be sent in-band';
      var filtered = MCP.prototype.filterOutgoing.call(null, inBandMessage);
      assert.equal(filtered, `#$"${inBandMessage}`);
    });

    it('escapes quote prefix', () => {
      var inBandMessage = '#$"Some message meant to be sent in-band';
      var filtered = MCP.prototype.filterOutgoing.call(null, inBandMessage);
      assert.equal(filtered, `#$"${inBandMessage}`);
    });

    it('lets lines with no special prefixes through unmodified', () => {
      var inBandMessage = 'Some message meant to be sent in-band';
      var filtered = MCP.prototype.filterOutgoing.call(null, inBandMessage);
      assert.equal(filtered, inBandMessage);
    });
  });

  describe('_handleOutOfBandLine', () => {
    var instance, execution;

    beforeEach(() => {
      execution = {};
      instance = {
        _startup: function(line) {
          execution['_startup'] = {line};
        },
        _handleMessageStart: function(line) {
          execution['_handleMessageStart'] = {line};
        },
        _handleMessageContinue: function(line) {
          execution['_handleMessageContinue'] = {line};
        },
        _handleMessageEnd: function(line) {
          execution['_handleMessageEnd'] = {line};
        }
      };
    });

    it('handles mcp startup sequence', () => {
      var line = 'mcp version: 2.1 to: 2.1';
      MCP.prototype._handleOutOfBandLine.call(instance, line);
      assert.equal(execution['_startup'].line, line);
    });

    it('handles message start line', () => {
      var line = 'do-stuff auth123 from: me text*: "" _data-tag: dtag123';
      MCP.prototype._handleOutOfBandLine.call(instance, line);
      assert.equal(execution['_handleMessageStart'].line, line);
    });

    it('handles multiline message continuation line', () => {
      var line = '* dtag123 text: one of the lines from a multiline value';
      MCP.prototype._handleOutOfBandLine.call(instance, line);
      assert.equal(execution['_handleMessageContinue'].line, line);
    });

    it('handles multiline message end line', () => {
      var line = ': dtag123';
      MCP.prototype._handleOutOfBandLine.call(instance, line);
      assert.equal(execution['_handleMessageEnd'].line, line);
    });

    it('catches errors', () => {
      var line = ': this will route to _handleMessageEnd';
      instance._handleMessageEnd = function() {
        this.calledHandleMessageEnd = true;
        throw Error();
      };
      assert.doesNotThrow(() =>
        MCP.prototype._handleOutOfBandLine.call(instance, line));
      assert.isTrue(instance.calledHandleMessageEnd);
    });
  });

  describe('_startup', () => {
    var instance, execution;
    var authKey = 'key123';

    beforeEach(() => {
      execution = {};
      instance = {};
      MCP.call(instance, {send: null});
      instance._generateAuthKey = function() {
        this.authKey = authKey;
      };
      instance._sendMessage = function(name, keyVals) {
        execution['_sendMessage'] = {name, keyVals};
      };
    });

    describe('server mcp version range includes 2.1', () => {
      it('responds with auth key', () => {
        var line = 'mcp version: 2.1 to: 2.1';
        MCP.prototype._startup.call(instance, line);
        assert.deepEqual(execution['_sendMessage'], {
          name: 'mcp',
          keyVals: {
            'authentication-key': authKey,
            version: '2.1',
            to: '2.1'
          }
        });
      });

      it('begins package negotiation');
    });

    it('ignores startup if missing version info', () => {
      var line = 'mcp apple: 2.1 banana: 2.1';
      assert.throws(() => MCP.prototype._startup.call(instance, line),
        /Missing version info/);
    });

    it('ignores startup if server mcp version is lower than 2.1', () => {
      var line = 'mcp version: 1.0 to: 2.0';
      assert.throws(() => MCP.prototype._startup.call(instance, line),
        /Server version too low/);
    });

    it('ignores startup if server mcp version is higher than 2.1', () => {
      var line = 'mcp version: 2.5 to: 3.1';
      assert.throws(() => MCP.prototype._startup.call(instance, line),
        /Server version too high/);
    });
  });

  describe('_generateAuthKey', () => {
    var instance;

    beforeEach(() => {
      instance = {};
    });

    it('sets the authentication key', () => {
      MCP.prototype._generateAuthKey.call(instance);
      assert.isString(instance.authKey);
    });
  });

  describe('_handleMessageStart', () => {
    var instance, execution;

    beforeEach(() => {
      execution = {};
      instance = {};
      MCP.call(instance, {send: null});
      instance._processMessage = function(name, keyVals) {
        execution['_processMessage'] = {name, keyVals};
      };
      instance.authKey = 'key123';
    });

    it('processes single line message', () => {
      var line = `send ${instance.authKey} to: Alice text: Hello!`;
      MCP.prototype._handleMessageStart.call(instance, line);
      assert.deepEqual(execution['_processMessage'], {
        name: 'send',
        keyVals: {to: 'Alice', text: 'Hello!'}
      });
    });

    it('stores multiline message', () => {
      var line = `send ${instance.authKey} to: Bob text*: "" _data-tag: dtag123`;
      MCP.prototype._handleMessageStart.call(instance, line);
      assert.isNotOk(execution['_processMessage']);
      assert.deepNestedInclude(instance.multilineMessages['dtag123'], {
        '.name': 'send',
        '.keyVals.to': 'Bob',
        '.keyVals.text': []
      });
    });

    it('discards value associated with multiline key', () => {
      var line = `send ${instance.authKey} to: Chris text*: "not-used" _data-tag: dtag123`;
      MCP.prototype._handleMessageStart.call(instance, line);
      assert.deepEqual(instance.multilineMessages['dtag123'].keyVals.text, []);
    });

    it('throws error on incorrect auth key', () => {
      var line = `send WrongAuthKey to: David text: Hey`;
      assert.throws(
        () => MCP.prototype._handleMessageStart.call(instance, line),
        /incorrect authentication key/i);
    });

    it('throws error on multiline key without data tag', () => {
      var line = `send ${instance.authKey} to: Elise text*: ""`;
      assert.throws(
        () => MCP.prototype._handleMessageStart.call(instance, line),
        /Missing data tag/i);
    });

    it('throws error on in-use data tag', () => {
      instance.multilineMessages = {
        'dtag123': {name: 'do-stuff', keyVals: {data: []}}
      };
      var line = `send ${instance.authKey} to: Fred text*: "" _data-tag: dtag123`;
      assert.throws(
        () => MCP.prototype._handleMessageStart.call(instance, line),
        /Data tag .* already in use/i);
    });

    describe('parsing', () => {
      it('allows extra spaces between tokens', () => {
        var line = `poke  ${instance.authKey}  who:  Greg  `;
        MCP.prototype._handleMessageStart.call(instance, line);
        assert.deepEqual(execution['_processMessage'], {
          name: 'poke',
          keyVals: {who: 'Greg'}
        });
      });

      it('treats authentication key as case-sensitive', () => {
        instance.authKey = 'lowercase';
        var line = `ping ${instance.authKey.toUpperCase()}`;
        assert.throws(
          () => MCP.prototype._handleMessageStart.call(instance, line),
          /Incorrect authentication key/i);
      });

      it('treats message name as case-insensitive', () => {
        var line1 = `yo ${instance.authKey}`;
        var line2 = `YO ${instance.authKey}`;
        function messageName(line) {
          MCP.prototype._handleMessageStart.call(instance, line);
          return execution['_processMessage'].name;
        }
        assert.equal(messageName(line1), messageName(line2));
      });

      it('treats keywords as case-insensitive', () => {
        var line = `poke ${instance.authKey} who: me WHO: you`;
        assert.throws(
          () => MCP.prototype._handleMessageStart.call(instance, line),
          /Duplicated keyword/i);
      });

      it('treats values as case-sensitive', () => {
        var text = 'Yo!';
        var line1 = `yo ${instance.authKey} text: ${text}`;
        var line2 = `yo ${instance.authKey} text: ${text.toLowerCase()}`;
        function messageValue(line) {
          MCP.prototype._handleMessageStart.call(instance, line);
          return execution['_processMessage'].keyVals.text;
        }
        var result1 = messageValue(line1);
        var result2 = messageValue(line2);
        assert.notEqual(result1, result2);
        assert.equal(result1.toLowerCase(), result2.toLowerCase());
      });

      it('throws error on invalid keyword token', () => {
        var line = `work-it ${instance.authKey} missingColon oops`;
        assert.throws(
          () => MCP.prototype._handleMessageStart.call(instance, line),
          /Invalid keyword token/i);
      });

      it('throws error on duplicated keyword', () => {
        var line = `sit ${instance.authKey} where: chair where: sofa`;
        assert.throws(
          () => MCP.prototype._handleMessageStart.call(instance, line),
          /Duplicated keyword/i);
      });

      it('throws error if value missing for last keyword', () => {
        var line = `nap ${instance.authKey} duration: `;
        assert.throws(
          () => MCP.prototype._handleMessageStart.call(instance, line),
          /Missing value/i);
      });

      it('throws error if unquoted value has colon', () => {
        var line = `net ${instance.authKey} addr: 3e:15:c2:ec:b3:00`;
        assert.throws(
          () => MCP.prototype._handleMessageStart.call(instance, line),
          /Invalid characters/i);
      });

      it('throws error if unquoted value has a double-quote character', () => {
        var line = `brunch ${instance.authKey} at: Danny"s`;
        assert.throws(
          () => MCP.prototype._handleMessageStart.call(instance, line),
          /Invalid characters/i);
      });

      it('throws error if unquoted value has a backslash', () => {
        var line = `display ${instance.authKey} text: two\\nlines`;
        assert.throws(
          () => MCP.prototype._handleMessageStart.call(instance, line),
          /Invalid characters/i);
      });

      describe('quoted value', () => {
        it('preserves spaces', () => {
          var textWithSpaces = '  spaces   everywhere ';
          var line = `display ${instance.authKey} text: "${textWithSpaces}"`;
          MCP.prototype._handleMessageStart.call(instance, line);
          assert.equal(execution['_processMessage'].keyVals.text, textWithSpaces);
        });

        it('preserves case', () => {
          var caseSensitiveText = 'This message has both UPPERCASE and lowercase';
          var line = `display ${instance.authKey} text: "${caseSensitiveText}"`;
          MCP.prototype._handleMessageStart.call(instance, line);
          assert.equal(execution['_processMessage'].keyVals.text, caseSensitiveText);
        });

        it('can represent empty strings', () => {
          var line = `display ${instance.authKey} text: ""`;
          MCP.prototype._handleMessageStart.call(instance, line);
          assert.equal(execution['_processMessage'].keyVals.text, '');
        });

        it('throws error if missing closing quote', () => {
          var line = `display ${instance.authKey} text: "forgot to close quote`;
          assert.throws(
            () => MCP.prototype._handleMessageStart.call(instance, line),
            /Unclosed quote/i);
        });

        describe('quote escaping', () => {
          var backslash = '\\';
          var quote = '"';
          var escapedQuote = backslash + quote;
          var escapedBackslash = backslash + backslash;

          it('can have escaped quotes and backslashes', () => {
            var line = `display ${instance.authKey} text: "${escapedQuote}${escapedBackslash}"`;
            MCP.prototype._handleMessageStart.call(instance, line);
            assert.equal(execution['_processMessage'].keyVals.text, quote + backslash);
          });

          it('parses tokens ending with escaped quote as part of the quoted value', () => {
            function substitutable(parts) {
              return (...substitutions) => {
                var tokens = [parts[0]];
                for (let i=1; i<parts.length; i++) {
                  tokens.push(substitutions[i - 1]);
                  tokens.push(parts[i]);
                }
                return tokens.join('');
              };
            }
            var template = substitutable`Before quote token${0} and after quote`;
            var line = `display ${instance.authKey} text: "${template(escapedQuote)}"`;
            MCP.prototype._handleMessageStart.call(instance, line);
            assert.equal(execution['_processMessage'].keyVals.text, template(quote));
          });

          it('throws error if there are unescaped quotes', () => {
            var line = `display ${instance.authKey} text: "rogue quote${quote}oops"`;
            assert.throws(
              () => MCP.prototype._handleMessageStart.call(instance, line),
              /Unescaped quote or backslash/i);
          });

          it('throws error if there are unescaped backslashes', () => {
            var line = `display ${instance.authKey} text: "rogue backslash${backslash}oops"`;
            assert.throws(
              () => MCP.prototype._handleMessageStart.call(instance, line),
              /Unescaped quote or backslash/i);
          });
        });
      });
    });
  });

  describe('_handleMessageContinue', () => {
    var instance;
    var dataTag = 'dtag123';

    beforeEach(() => {
      instance = {};
      MCP.call(instance, {send: null});
      instance.multilineMessages[dataTag] = {
        name: 'send', keyVals: {}
      };
    });

    it('adds line to existing multiline key', () => {
      var keyVals = instance.multilineMessages[dataTag].keyVals;
      keyVals.text = ['Hello', 'there', 'how', 'are'];
      var line = `* ${dataTag} text: you`;
      MCP.prototype._handleMessageContinue.call(instance, line);
      assert.equal(keyVals.text.length, 5);
      assert.equal(keyVals.text[keyVals.text.length - 1], 'you');
    });

    it('treats all characters after keywords as is without escaping', () => {
      var keyVals = instance.multilineMessages[dataTag].keyVals;
      keyVals.text = [];
      var messageText = '  leading  spaces un\\esc"aped ch*r:s and esc\\"ape seq\\\\uences';
      var line = `* ${dataTag} text: ${messageText}`;
      MCP.prototype._handleMessageContinue.call(instance, line);
      assert.equal(keyVals.text[0], messageText);
    });

    it('treats data tag as case-sensitive', () => {
      var dataTag = 'lowercase';
      instance.multilineMessages[dataTag] = {
        name: 'send', keyVals: {text: []}};
      var line = `* ${dataTag.toUpperCase()} text: bad tag`;
      assert.throws(
        () => MCP.prototype._handleMessageContinue.call(instance, line),
        /No multiline message with data tag/i);
    });

    it('throws error on unmatched data tag', () => {
      var line = `* UnmatchedTag text: bad tag`;
      assert.throws(
        () => MCP.prototype._handleMessageContinue.call(instance, line),
        /No multiline message with data tag/i);
    });

    it('throws error on missing keyword', () => {
      var line = `* ${dataTag} there is no keyword`;
      assert.throws(
        () => MCP.prototype._handleMessageContinue.call(instance, line),
        /No keyword in multiline continuation message/i);
    });

    it('throws error on unknown keyword', () => {
      var messages = instance.multilineMessages[dataTag];
      messages.keyVals = {known: ['some existing text']};
      var line = `* ${dataTag} unknown: some text`;
      assert.throws(
        () => MCP.prototype._handleMessageContinue.call(instance, line),
        /Unknown keyword/i);
    });

    it('throws error on non-multiline keyword', () => {
      var messages = instance.multilineMessages[dataTag];
      messages.keyVals = {text: 'single line value'};
      var line = `* ${dataTag} text: some text`;
      assert.throws(
        () => MCP.prototype._handleMessageContinue.call(instance, line),
        /Non-multiline keyword/i);
    });
  });

  describe('_handleMessageEnd', () => {
    var instance, execution;
    var dataTag = 'dtag123';

    beforeEach(() => {
      execution = {};
      instance = {};
      MCP.call(instance, {send: null});
      instance._processMessage = function(name, keyVals) {
        execution['_processMessage'] = {name, keyVals};
      };
      instance.authKey = 'key123';
    });

    it('processes multiline message', () => {
      var message = {name: 'send', keyVals: {}};
      instance.multilineMessages[dataTag] = message;
      var line = `: ${dataTag}`;
      MCP.prototype._handleMessageEnd.call(instance, line);
      assert.deepEqual(execution['_processMessage'], {
        name: message.name,
        keyVals: message.keyVals
      });
    });

    it('closes multiline message from appends', () => {
      instance.multilineMessages[dataTag] = {name: 'send', keyVals: {}};
      var line = `: ${dataTag}`;
      MCP.prototype._handleMessageEnd.call(instance, line);
      assert.isNotOk(instance.multilineMessages[dataTag]);
    });

    it('ignores tokens following data tag', () => {
      var message = {name: 'send', keyVals: {}};
      instance.multilineMessages[dataTag] = message;
      var line = `: ${dataTag} anything can go here`;
      MCP.prototype._handleMessageEnd.call(instance, line);
      assert.deepEqual(execution['_processMessage'].keyVals, message.keyVals);
    });

    it('throws error on unmatched data tag', () => {
      var line = `: UnmatchedTag`;
      assert.throws(
        () => MCP.prototype._handleMessageEnd.call(instance, line),
        /No multiline message with data tag/i);
    });
  });

  describe('_processMessage', () => {});
  describe('_sendMessage', () => {});
});
