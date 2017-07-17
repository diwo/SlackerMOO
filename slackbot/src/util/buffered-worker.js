'use strict';

const Deque = require('double-ended-queue');

function BufferedWorker({extract, execute}) {
  this.extract = extract;
  this.execute = execute;
  this.queue = new Deque();
  this.running = false;
  this.previous = null;
}

BufferedWorker.prototype.enqueue = function(...data) {
  this.queue.push(...data);
  if (!this.running) {
    this._run();
  }
};

BufferedWorker.prototype._run = async function() {
  if (this.queue.isEmpty()) {
    this.running = false;
    return;
  }

  this.running = true;

  try {
    var payload = await this.extract(readOnlyQueue(this.queue), this.previous);
    var result = await this.execute(payload, this.previous);
    this.previous = {payload, result};
    return this._run();

  } catch (error) {
    console.error(error);
    this.queue.clear();
    this.running = false;
    this.previous = null;
  }
};

function readOnlyQueue(deque) {
  return {
    isEmpty: Deque.prototype.isEmpty.bind(deque),
    peek: Deque.prototype.peekFront.bind(deque),
    pop: Deque.prototype.shift.bind(deque)
  };
}

module.exports = BufferedWorker;
