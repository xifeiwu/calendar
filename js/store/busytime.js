define(function(require, exports, module) {
'use strict';

var Abstract = require('./abstract');
var Calc = require('calc');
var TimeObserver = require('time_observer');
var binsearch = require('binsearch');
var compare = require('compare');
var denodeifyAll = require('promise').denodeifyAll;
var notificationsController = require('controllers/notifications');
var debug = require('debug')('store/busytime');

/**
 * Objects saved in the busytime store:
 *
 *    {
 *      _id: (uuid),
 *      start: Calendar.Calc.dateToTransport(x),
 *      end: Calendar.Calc.dateToTransport(x),
 *      eventId: eventId,
 *      calendarId: calendarId
 *    }
 *
 */
function Busytime() {
  Abstract.apply(this, arguments);
  this._setupCache();

  denodeifyAll(this, [
    'removeEvent',
    'loadSpan',
    'busytimesForEvent',
    'busytimeForEvent',
    'deleteFutureBusytimes',
    'busytimeCountsForEvent',
    'findBusytimesByAlarm'
  ]);
}
module.exports = Busytime;

Busytime.prototype = {
  __proto__: Abstract.prototype,

  _store: 'busytimes',

  _dependentStores: ['busytimes'],

  _setupCache: function() {
    // reset time observers
    TimeObserver.call(this);

    this._byEventId = Object.create(null);
  },

  _createModel: function(input, id) {
    return this.initRecord(input, id);
  },

  initRecord: function(input, id) {
    var _super = Abstract.prototype._createModel;
    var model = _super.apply(this, arguments);
    model.startDate = Calc.dateFromTransport(model.start);
    model.endDate = Calc.dateFromTransport(model.end);
    return model;
  },

  _removeDependents: function(id, trans) {
    // delete notification if exist.
    notificationsController.closeNotificationById(id);
    // remove alarm of this busytime.
    trans.addEventListener('complete', () => {
      var request = navigator.mozAlarms.getAll();
      request.onsuccess = function (e) {
        e.target.result.some((alarm) => {
          if (alarm.data.busytimeId === id) {
            navigator.mozAlarms.remove(alarm.id);
            return true;
          }
          return false;
        });
      };
      request.onerror = function () {
        debug('remove alarm error.');
      };
    });
  },

  removeEvent: function(id, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }

    if (typeof(trans) === 'undefined') {
      trans = this.db.transaction(
        this._dependentStores,
        'readwrite'
      );
    }

    // build the request using the inherited method
    var req = this.removeByIndex('eventId', id, trans);

    // get the original method which handles the generic bit
    var success = req.onsuccess;

    // override the default .onsuccess to get the ids
    // so we can emit remove events.
    var self = this;
    req.onsuccess = function(e) {
      var cursor = e.target.result;

      if (cursor) {
        var id = cursor.primaryKey;
        self.emit('remove', id);
      }

      success(e);
    };

    this._transactionCallback(trans, callback);
  },

  _startCompare: function(aObj, bObj) {
    var a = aObj.start.utc;
    var b = bObj.start.utc;
    return compare(a, b);
  },

  /**
   * Loads all busytimes in given timespan.
   *
   * @param {Calendar.Timespan} span timespan.
   * @param {Function} callback node style callback
   *                            where first argument is
   *                            an error (or null)
   *                            and the second argument
   *                            is a list of all loaded
   *                            busytimes in the timespan.
   */
  loadSpan: function(span, callback) {
    var trans = this.db.transaction(this._store);
    var store = trans.objectStore(this._store);

    var startPoint = Calc.dateToTransport(new Date(span.start));
    var endPoint = Calc.dateToTransport(new Date(span.end));

    // XXX: we need to implement busytime chunking
    // to make this efficient.
    var keyRange = IDBKeyRange.lowerBound(startPoint.utc);

    var index = store.index('end');
    var self = this;

    index.mozGetAll(keyRange).onsuccess = function(e) {
      var data = e.target.result;

      // sort data
      data = data.sort(self._startCompare);

      // attempt to find a start time that occurs
      // after the end time of the span
      var idx = binsearch.insert(
        data,
        { start: { utc: endPoint.utc + 1 } },
        self._startCompare
      );

      // remove unrelated timespan...
      data = data.slice(0, idx);

      // fire callback
      if (callback) {
        callback(null, data.map(function(item) {
          return self.initRecord(item);
        }));
      }

    };
  },

  /* we don't use id based caching for busytimes */

  _addToCache: function() {},
  _removeFromCache: function() {},

  /**
   * Loads all busytimes for given eventId
   * and returns results. Does not cache.
   *
   * @param {String} eventId to find.
   * @param {Function} callback node style [err, array of busytimes].
   */
  busytimesForEvent: function(eventId, callback) {
    var trans = this.db.transaction(this._store);
    var store = trans.objectStore(this._store);
    var index = store.index('eventId');
    var key = IDBKeyRange.only(eventId);

    var req = index.mozGetAll(key);

    req.onsuccess = function(e) {
      callback(null, e.target.result);
    };

    req.onerror = function(e) {
      callback(e);
    };
  },

  busytimeForEvent: function(eventId, date, callback) {
    this.busytimesForEvent(eventId, (err, busytimes) => {
      if (err) {
        return callback(err);
      }
      busytimes.forEach((busytime) => {
        var bStart = new Date(busytime.start.utc);
        if (Calc.isSameDate(bStart, date)) {
          return callback(null, busytime);
        }
      });
      callback(null);
    });
  },

  /**
   * return busytime counts for current event
   *
   * @param {String} eventId to find.
   * @param {IDBTransaction} trans transaction.
   * @param {Function} callback node style [err, counts of busytimes].
   */
  busytimeCountsForEvent: function(eventId, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }
    if (!trans) {
      trans = this.db.transaction(this._store, 'readonly');
    }
    var indexedStore = trans.objectStore(this._store).index('eventId');
    var req = indexedStore.count(window.IDBKeyRange.only(eventId));
    req.onsuccess = function(evt) {
      callback(null, evt.target.result);
    };
    req.onerror = function(evt) {
      callback(evt);
    };
  },

  /**
   * delete all busytimes with eventId the same as eventId parameter
   * after startDate
   *
   * @param {String} eventId to find.
   * @param {Date} startDate set start date.
   * @param {Function} callback node style [err, array of busytimes].
   */
  deleteFutureBusytimes: function(eventId, startDate, trans, callback) {
    var self = this;
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }
    if (!trans) {
      trans = this.db.transaction(this._store, 'readwrite');
    }
    if (callback) {
      trans.addEventListener('complete', function() {
        if (callback) {
          callback(null, eventId);
        }
      });
      trans.addEventListener('error', function(event) {
        if (callback) {
          callback(event);
        }
      });
    }

    var indexedStore = trans.objectStore(this._store).index('eventId');
    var req = indexedStore.openCursor(IDBKeyRange.only(eventId));
    req.onsuccess = function(evt) {
      var cursor = evt.target.result;
      if (cursor) {
        var date = Calc.dateFromTransport(cursor.value.start);
        if (date.valueOf() > startDate.valueOf()) {
          self.remove(cursor.value._id, trans);
        }
        cursor.continue();
      }
    };
    req.onerror = function(evt) {
      debug('request cursor error.');
    };
  },

  findBusytimesByAlarm: function(presentDay, days, callback) {
    var toLoad = Calc.spanOfSeveralDay(presentDay, days);
    this.loadSpan(toLoad, (err, busytimes) => {
      if (err) {
        callback(err);
      }
      var results = busytimes.filter((busytime) => {
        if (!busytime.alarms) {
          return false;
        }
        return busytime.alarms.some((alarm) => {
          var startDate = Calc.dateFromTransport(alarm.start);
          var presentDayEnd = Calc.endOfDay(presentDay);
          var isBeforeToday = startDate.valueOf() < presentDayEnd.valueOf();
          if (isBeforeToday && !alarm.triggered) {
            return true;
          }
          return false;
        });
      });
      callback(null, results);
    });
  }
};

});
