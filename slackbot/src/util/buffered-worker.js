'use strict';

const Deque = require('double-ended-queue');

function BufferedWorker({extract, execute}) {
  this.extract = extract;
  this.execute = execute;
  this.queue = new Deque();
  this.task = null;
  this.previous = null;
}

BufferedWorker.prototype.enqueue = function(...data) {
  this.queue.push(...data);
  if (!this.task) {
    this.task = this._work();
  }
};

BufferedWorker.prototype._work = function() {
  // Promise.resolve() so that method returns right away
  return Promise.resolve().then(() => {
    if (this.queue.isEmpty()) {
      this.task = null;
      return null;
    }

    var payload = this.extract(readOnlyQueue(this.queue), this.previous);
    var execution = this.execute(payload, this.previous);

    return Promise.resolve(execution).then(
      result => {
        this.previous = {payload, result};
        return this._work();
      },
      error => {
        console.error(error);
        this.queue.clear();
        this.task = null;
        this.previous = null;
      });
  });
};

function readOnlyQueue(deque) {
  return {
    isEmpty: Deque.prototype.isEmpty.bind(deque),
    peek: Deque.prototype.peekFront.bind(deque),
    pop: Deque.prototype.shift.bind(deque)
  };
}

module.exports = BufferedWorker;
