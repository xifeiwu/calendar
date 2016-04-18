define(function(require, exports, module) {
'use strict';

var Abstract = require('./abstract');
var Calc = require('calc');
var Calendar = require('./calendar');
var denodeifyAll = require('promise').denodeifyAll;
var providerFactory = require('provider/provider_factory');
var debug = require('debug')('store/event');

function Events() {
  Abstract.apply(this, arguments);

  denodeifyAll(this, [
    'providerFor',
    'findByIds',
    'ownersOf',
    'eventsForCalendar',
    'deleteFutureExEvents',
    'exEventCountsForEvent'
  ]);
}
module.exports = Events;

Events.prototype = {
  __proto__: Abstract.prototype,
  _store: 'events',
  _dependentStores: ['events', 'busytimes', 'icalComponents'],

  /** disable caching */
  _addToCache: function() {},
  _removeFromCache: function() {},

  _createModel: function(input, id) {
    var _super = Abstract.prototype._createModel;
    var model = _super.apply(this, arguments);
    model.remote.startDate = Calc.dateFromTransport(model.remote.start);
    model.remote.endDate = Calc.dateFromTransport(model.remote.end);
    return model;
  },

  /**
   * Link busytime dependants see _addDependents.
   */
  _removeDependents: function(id, trans) {
    this.removeByIndex('parentId', id, trans);

    var busy = this.db.getStore('Busytime');
    busy.removeEvent(id, trans);

    var component = this.db.getStore('IcalComponent');
    component.remove(id, trans);
  },

  /**
   * Generate an id for a newly created record.
   * Based off of remote id (uuid) and calendar id.
   */
  _assignId: function(obj) {
    var id = obj.calendarId + '-' + obj.remote.id;
    obj._id = id;
    return id;
  },

  /**
   * Shortcut finds provider for given event.
   *
   * @param {Object} event full event record from db.
   */
  providerFor: function(event, callback) {
    this.ownersOf(event, function(err, owners) {
      callback(null, providerFactory.get(owners.account.providerType),
        owners/* export account and calendar */);
    });
  },

  /**
   * Finds a list of events by id.
   *
   * @param {Array} ids list of ids.
   * @param {Function} callback node style second argument
   *                            is an object of _id/event.
   */
  findByIds: function(ids, callback) {
    var results = {};
    var pending = ids.length;
    var self = this;

    if (!pending) {
      callback(null, results);
    }

    function next() {
      if (!(--pending)) {
        // fatal errors should break
        // and so we are not handling them
        // here...
        callback(null, results);
      }
    }

    function success(e) {
      var item = e.target.result;

      if (item) {
        results[item._id] = self._createModel(item);
      }

      next();
    }

    function error() {
      // can't find it or something
      // skip!
      next();
    }

    ids.forEach(function(id) {
      var trans = this.db.transaction('events');
      var store = trans.objectStore('events');
      var req = store.get(id);

      req.onsuccess = success;
      req.onerror = error;
    }, this);
  },

  /**
   * Finds calendar/account for a given event.
   *
   * @param {Object} event must contain .calendarId.
   * @param {Function} callback [err, { ... }].
   */
  ownersOf: Calendar.prototype.ownersOf,
  /**
   * Loads all events for given calendarId
   * and returns results. Does not cache.
   *
   * @param {String} calendarId calendar to find.
   * @param {Function} callback node style [err, array of events].
   */
  eventsForCalendar: function(calendarId, callback) {
    var trans = this.db.transaction('events');
    var store = trans.objectStore('events');
    var index = store.index('calendarId');
    var key = IDBKeyRange.only(calendarId);

    var req = index.mozGetAll(key);

    req.onsuccess = function(e) {
      callback(null, e.target.result);
    };

    req.onerror = function(e) {
      callback(e);
    };
  },

  /**
   * return exception event counts for current event
   *
   * @param {String} eventId to find.
   * @param {IDBTransaction} trans transaction.
   * @param {Function} callback node style [err, counts of busytimes].
   */
  exEventCountsForEvent: function(eventId, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }
    if (!trans) {
      trans = this.db.transaction(this._store, 'readonly');
    }
    var indexedStore = trans.objectStore(this._store).index('parentId');
    var req = indexedStore.count(window.IDBKeyRange.only(eventId));
    req.onsuccess = function(evt) {
      callback(null, evt.target.result);
    };
    req.onerror = function(evt) {
      callback(evt);
    };
  },

  /**
   * delete all exception events with parentId the same as eventId parameter
   * after startDate
   *
   * @param {String} eventId to find.
   * @param {Date} startDate set start date.
   * @param {Function} callback node style [err, array of busytimes].
   */
  deleteFutureExEvents: function(eventId, startDate, trans, callback) {
    var self = this;
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }
    if (!trans) {
      trans = this.db.transaction(
        this._dependentStores || this._store,
        'readwrite'
      );
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

    var indexedStore = trans.objectStore(this._store).index('parentId');
    var req = indexedStore.openCursor(IDBKeyRange.only(eventId));
    req.onsuccess = function(evt) {
      var cursor = evt.target.result;
      if (cursor) {
        var date = Calc.dateFromTransport(cursor.value.remote.recurrenceId);
        if (date.valueOf() > startDate.valueOf()) {
          self.remove(cursor.value._id, trans);
        }
        cursor.continue();
      }
    };
    req.onerror = function(evt) {
      debug('request cursor error.');
    };
  }
};

});
