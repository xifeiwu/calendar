define(function(require, exports, module) {
'use strict';

var Abstract = require('./abstract');
var Calc = require('calc');
var denodeifyAll = require('promise').denodeifyAll;
var Timespan = require('timespan');

function IcalComponent() {
  Abstract.apply(this, arguments);

  denodeifyAll(this, [
    'findRecurrencesBefore',
    'findRecurrencesBySpan'
  ]);
}
module.exports = IcalComponent;

IcalComponent.prototype = {
  __proto__: Abstract.prototype,

  _store: 'icalComponents',

  _dependentStores: ['icalComponents'],

  /** disable caching */
  _addToCache: function() {},
  _removeFromCache: function() {},

  _createModel: function(object) {
    return object;
  },

  _detectPersistType: function(object) {
    // always fire update.
    return 'update';
  },

  /**
   * Finds all components which have recurrences
   * that are not expanded beyond the given date.
   *
   * @param {Date} maxDate max date to find.
   * @param {Function} callback results of search [err, [icalComp, ...]].
   */
  findRecurrencesBefore: function(maxDate, callback) {
    var trans = this.db.transaction(this._store, 'readwrite');

    trans.onerror = function(event) {
      callback(event.target.error.name);
    };

    var time = Calc.dateToTransport(maxDate);
    var utc = time.utc;
    var range = IDBKeyRange.bound(0, utc);
    var store = trans.objectStore(this._store);
    var idx = store.index('lastRecurrenceId');

    var req = idx.mozGetAll(range);

    req.onsuccess = function(event) {
      callback(null, event.target.result);
    };
  },

  /**
   * Finds all components which have recurrences
   * that not cover expandSpan.
   *
   * @param {Timespan} expandSpan scope the date to expand.
   * @param {Function} callback results of search [err, [icalComp, ...]].
   */
  findRecurrencesBySpan: function(expandSpan, callback) {
    var trans = this.db.transaction(this._store, 'readonly');
    trans.onerror = function(event) {
      callback(event.target.error.name);
    };

    var store = trans.objectStore(this._store);
    var req = store.mozGetAll();
    req.onsuccess = function(event) {
      var targets = event.target.result.filter((component) => {
        if (!component.spans) {
          component.spans = [];
          return true;
        }
        return !component.spans.some((span) => {
          span = Timespan.fromJSON(span);
          if (span.contains(expandSpan)) {
            return true;
          }
          return false;
        });
      });
      targets.forEach((target) => {
        var toSpan = expandSpan.clone();
        var timeSpans = target.spans.map((span) => {
          return Timespan.fromJSON(span);
        });
        for (var i = 0; i < timeSpans.length; i++) {
          if (timeSpans[i].overlaps(toSpan)) {
            toSpan = timeSpans[i].trimOverlap(toSpan);
          }
        }
        if (toSpan) {
          target.toSpan = toSpan.toJSON();
        } else {
          target.toSpan = null;
        }
      });
      callback(null, targets);
    };
  },

  refresh: function(object, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }
    if (!trans) {
      trans = this.db.transaction(this._store, 'readwrite');
    }

    var store = trans.objectStore(this._store).index('eventId');
    var req = store.openCursor(window.IDBKeyRange.only(object.eventId));
    req.onsuccess = function(event) {
      var cursor = event.target.result;
      if (!cursor) {
        return;
      }
      var record = cursor.value;
      if (!record.spans) {
        record.spans = [record.span];
      } else {
        var spans = record.spans;
        spans.push(object.span);
        spans = spans.sort((a, b) => {
          return a.start - b.start;
        }).map((span) => {
          return Timespan.fromJSON(span);
        });
        var finish = false;
        do {
          for (var i = 0; i < spans.length; i++) {
            if (spans[i + 1]) {
              if (spans[i].canCombine(spans[i + 1])) {
                spans.splice(i, 2, spans[i].combine(spans[i + 1]));
                break;
              }
            } else {
              finish = true;
            }
          }
        } while(!finish);
        record.spans = spans.map((span) => {
          return span.toJSON();
        });
      }
      record.ical = object.ical;
      cursor.update(record);
      cursor.continue();
    };
    req.onerror = function(event) {
      console.log('refresh icalComponents fail: ' + event);
      callback(event.target.error.name);
    };
  }
};

});
