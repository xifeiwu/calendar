define(function(require, exports, module) {
'use strict';

var Abstract = require('./abstract');
var mutations = require('event_mutations');
var uuid = require('ext/uuid');
var ICAL = require('ext/ical');
var CaldavPullEvents = require('provider/caldav_pull_events');
var nextTick = require('next_tick');
var IcalComposer = require('ical/composer');
var IcalHelper = require('ical/helper');
var Calc = require('calc');

var LOCAL_CALENDAR_ID = 'local-first';

function Local() {
  Abstract.apply(this, arguments);
}
module.exports = Local;

Local.calendarId = LOCAL_CALENDAR_ID;

/**
 * Returns the details for the default calendars.
 */
Local.defaultCalendar = function() {
  // XXX: Make async
  var l10nId = 'calendar-local';
  var name;

  if ('mozL10n' in window.navigator) {
    name = window.navigator.mozL10n.get(l10nId);
    if (name === l10nId) {
      name = null;
    }
  }

  if (!name) {
    name = 'Offline calendar';
  }

  return {
    // XXX localize this name somewhere
    name: name,
    id: LOCAL_CALENDAR_ID,
    color: Local.prototype.defaultColor
  };

};

Local.prototype = {
  __proto__: Abstract.prototype,

  canExpandRecurringEvents: true,

  getAccount: function(account, callback) {
    callback(null, {});
  },

  findCalendars: function(account, callback) {
    var trans = this.db.transaction('calendars');
    var store = trans.objectStore('calendars');
    var index = store.index('accountId');
    var key = IDBKeyRange.only(account._id);

    var req = index.mozGetAll(key);

    req.onsuccess = function(e) {
      callback(null, e.target.result);
    };

    req.onerror = function(e) {
      callback(e);
    };
  },

  syncEvents: function(account, calendar, cb) {
    cb(null);
  },

  /**
   * @return {Calendar.EventMutations.Create} mutation object.
   */
  createEvent: function(event, callback) {
    // most providers come with their own built in
    // id system when creating a local event we need to generate
    // our own UUID.
    if (!event.remote.id) {
      // TOOD: uuid is provided by ext/uuid.js
      //       if/when platform supports a safe
      //       random number generator (values never conflict)
      //       we can use that instead of uuid.js
      event.remote.id = uuid();
    }

    if (event.remote.isRecurring) {
      this._simulateCaldavProcess(event,
        IcalComposer.calendar(event), callback);
    } else {
      var create = mutations.create({ event: event });
      create.commit(function(err) {
        if (err) {
          return callback(err);
        }
        callback(null, create.busytime, create.event);
      });

      return create;
    }
  },

  deleteEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }
    if (!callback) {
      callback = function() {};
    }

    this.app.store('Event').remove(event._id, callback);
  },

  deleteSingleEvent: function(date, event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }
    if (!callback) {
      callback = function() {};
    }

    this.icalComponents.get(event._id, (err, component) => {
      if (err) {
        return callback(err);
      }
      var icalComp = ICAL.Component.fromString(component.ical);
      var eventComp = icalComp.getFirstSubcomponent('vevent');
      eventComp.addProperty(IcalComposer.exdate(event, date));

      this.deleteEvent(event, (err, evt) => {
        if (err) {
          return callback(err);
        }
        this._simulateCaldavProcess(event, icalComp.toString(), callback);
      });
    });
  },

  deleteFutureEvents: function(date, event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }
    if (!callback) {
      callback = function() {};
    }

    this.icalComponents.get(event._id, (err, component) => {
      if (err) {
        return callback(err);
      }
      var icalComp = ICAL.Component.fromString(component.ical);
      var eventComp = icalComp.getFirstSubcomponent('vevent');
      var rRrule = eventComp.getFirstPropertyValue('rrule');
      // we need to use parse here, since rRrule is not a normal object,
      // actually it's a json wrapper, we cannot modify it directly
      var newRrule = JSON.parse(JSON.stringify(rRrule));
      var until = new Date(date);
      var startDate = new Date(event.remote.startDate);
      // until means before
      until.setDate(until.getDate() - 1);
      until.setHours(startDate.getHours());
      until.setMinutes(startDate.getMinutes());
      until.setSeconds(startDate.getSeconds());
      newRrule.until = until.toString('yyyy-MM-ddTHH:mm:ss');
      eventComp.updatePropertyWithValue('rrule', newRrule);

      this.deleteEvent(event, (err, evt) => {
        if (err) {
          return callback(err);
        }
        this._simulateCaldavProcess(event, icalComp.toString(), callback);
      });
    });
  },

  updateExceptionEvent: function(event, callback) {
    this.icalComponents.get(event.parentId, (err, component) => {
      if (err) {
        return callback(err);
      }
      var vCalendar = ICAL.Component.fromString(component.ical);
      var vTimezoneComp = vCalendar.getFirstSubcomponent('vtimezone');
      var vTimezone = new ICAL.Timezone(vTimezoneComp);
      var vEvent = IcalHelper.getExceptionVEvent(vCalendar,
        event.remote.recurrenceId);
      if (!vEvent) {
        return callback(new Error());
      }

      if (!event.remote.isRecurring && event.remote.repeat === 'never') {
        vEvent.startDate = IcalHelper.toICALTime(event.remote.startDate,
          vTimezone);
        vEvent.endDate = IcalHelper.toICALTime(event.remote.endDate,
          vTimezone);
        vEvent.description = event.remote.description;
        vEvent.location = event.remote.location;
        vEvent.summary = event.remote.title;
        vEvent.sequence = vEvent.sequence + 1;
        this.deleteEvent(event, (err, evt) => {
          if (err) {
            return callback(err);
          }
          this._simulateCaldavProcess(event, vCalendar.toString(), callback);
        });
      } else {
        this._simulateCaldavProcess(event, IcalComposer.calendar(event),
          callback);
      }
    });
  },
  /**
   * @return {Calendar.EventMutations.Update} mutation object.
   */
  updateEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    // converting a normal event to a recurring event
    if (event.remote.isRecurring) {
      this.deleteEvent(event, (err, evt) => {
        if (err) {
          return callback(err);
        }
        nextTick(() => {
          this.createEvent(event, callback);
        });
      });
    } else {
      var update = mutations.update({ event: event });
      update.commit(function(err) {
        if (err) {
          return callback(err);
        }

        callback(null, update.busytime, update.event);
      });
      return update;
    }
  },

  updateEventAllFuture: function(startDate, event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    this.deleteFutureEvents(startDate, event, busytime, (err) => {
      if (err) {
        return callback(err);
      }

      var _event = ICAL.helpers.clone(event, true);
      var ical = IcalComposer.calendar(_event);
      this._simulateCaldavProcess(_event, ical, callback);
    });
  },

  /**
   * To update a single day of a recurring event
   */
  updateEventThisOnly: function(parentModel, event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    this.icalComponents.get(event._id, (err, component) => {
      if (err) {
        return callback(err);
      }
      // callback should return exception event's id
      var icalComp = ICAL.Component.fromString(component.ical);
      icalComp.addSubcomponent(
        ICAL.Component.fromString(
          IcalComposer.exceptionEvent(event, parentModel)
      ));

      this.deleteEvent(event, (err, evt) => {
        if (err) {
          return callback(err);
        }
        this._simulateCaldavProcess(event, icalComp.toString(),callback);
      });
    });
  },

  updateEventToNormal: function(event, callback) {
    this.deleteEvent(event, (err, evt) => {
      if (err) {
        return callback(err);
      }
      this._simulateCaldavProcess(event, IcalComposer.calendar(event),
        callback);
    });
  },

  _simulateCaldavProcess: function(event, ical, callback) {
    nextTick(() => {
      this.events.ownersOf(event, (err, owners) => {
        var stream = this.service.stream(
          'caldav',
          'streamEventsFromLocal',
          owners.account.toJSON(),
          owners.calendar.remote,
          {
            ical: ical,
            color: owners.calendar.remote.color
          }
        );

        var pull = new CaldavPullEvents(stream, {
          app: this.app,
          account: owners.account,
          calendar: owners.calendar
        });

        stream.request((err) => {
          if (err) {
            return callback(err);
          }

          pull.commit((commitErr, events, components, busytimes) => {
            if (commitErr) {
              callback(err);
            } else {
              // clean up all sub-stores since it's a empty recurring event
              if (busytimes && busytimes.length === 0) {
                nextTick(() => {
                  this.deleteEvent(event, () => {
                    callback(null);
                  });
                });
              } else {
                callback(null, events, components, busytimes);
              }
            }
          });
        });
      });
    });
  }
};

});
