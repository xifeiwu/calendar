/**
 * EventMutations are a simple wrapper for a
 * set of idb transactions that span multiple
 * stores and calling out to the time controller
 * at appropriate times so it can cache the information.
 *
 *
 * Examples:
 *
 *
 *    // create an event
 *    var mutation = Calendar.EventMutations.create({
 *      // this class does not handle/process events
 *      // only persisting the records. Busytimes will
 *      // automatically be recreated.
 *      event: event
 *    });
 *
 *    // add an optional component
 *    // mutation.icalComponent = component;
 *
 *    mutation.commit(function(err) {
 *      if (err) {
 *        // handle it
 *      }
 *
 *      // success event/busytime/etc.. has been created
 *    });
 *
 *
 *    // update an event:
 *    // update shares an identical api but will
 *    // destroy/recreate associated busytimes with event.
 *    var mutation = Calendar.EventMutations.update({
 *      event: event
 *    });
 *
 *    mutation.commit(function() {
 *
 *    });
 *
 *
 */
define(function(require, exports) {
'use strict';

var Calc = require('calc');
var uuid = require('ext/uuid');

/**
 * Create a single instance busytime for the given event object.
 *
 * @param {Object} event to create busytime for.
 */
function createBusytime(event) {
  var busytime = {
    _id: event._id + '-' + uuid.v4(),
    eventId: event._id,
    calendarId: event.calendarId,
    start: event.remote.start,
    end: event.remote.end
  };
  var alarms = event.remote.alarms;
  if (alarms && alarms.length) {
    busytime.alarms = [];
    var i = 0;
    var len = alarms.length;
    for (; i < len; i++) {
      var alarmDate = Calc.dateFromTransport(busytime.end);
      if (alarmDate.valueOf() < Date.now()) {
        continue;
      }
      var newAlarm = {};
      newAlarm.startDate = {};
      for (var j in busytime.start) {
        newAlarm.startDate[j] = busytime.start[j];
      }
      newAlarm.startDate.utc += (alarms[i].trigger * 1000);
      busytime.alarms.push(newAlarm);
    }
  }
  if (event.remote.isException || event.remote.recurrenceId) {
    busytime.recurrenceId = event.remote.recurrenceId;
    busytime.isException = event.remote.isException;
  }
  return busytime;
}

function Create(options) {
  if (options) {
    for (var key in options) {
      if (options.hasOwnProperty(key)) {
        this[key] = options[key];
      }
    }
  }
}

Create.prototype = {
  commit: function(callback) {
    var app = exports.app;
    var eventStore = app.store('Event');
    var busytimeStore = app.store('Busytime');
    var componentStore = app.store('IcalComponent');

    var trans = eventStore.db.transaction(
      eventStore._dependentStores,
      'readwrite'
    );

    trans.oncomplete = function commitComplete() {
      callback(null);
    };

    trans.onerror = function commitError(e) {
      callback(e.target.error);
    };

    eventStore.persist(this.event, trans);

    if (!this.busytime) {
      this.busytime = createBusytime(this.event);
    }

    busytimeStore.persist(this.busytime, trans);

    if (this.icalComponent) {
      componentStore.persist(this.icalComponent, trans);
    }
  }

};

function Update() {
  Create.apply(this, arguments);
}

Update.prototype = {
  commit: function(callback) {
    var app = exports.app;
    var busytimeStore = app.store('Busytime');
    var componentStore = app.store('IcalComponent');

    var self = this;

    componentStore.remove(self.event._id, function(err) {
      if (err) {
        callback(err);
        return;
      }
      // required so UI knows to refresh even in the
      // case where the start/end times are the same.
      busytimeStore.removeEvent(self.event._id, function(err) {
        if (err) {
          callback(err);
          return;
        }
        Create.prototype.commit.call(self, callback);
      });
    });
  }
};

/**
 * Will be injected...
 */
exports.app = null;

exports.create = function createMutation(option) {
  return new Create(option);
};

exports.update = function updateMutation(option) {
  return new Update(option);
};

});
