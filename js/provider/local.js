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

  /**
   * delete the recurring event if it has no busytime and exevent.
   */
  _deleteRecurEventIfNecessary: function(eventId) {
    Promise.all([
      this.busytimes.busytimeCountsForEvent(eventId),
      this.events.exEventCountsForEvent(eventId)
    ]).then(values => {
      if (values[0] === 0 && values[1] === 0) {
        this.deleteEvent(eventId);
      }
    });
  },

  deleteEvent: function(eventOrId, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }
    if (!callback) {
      callback = function() {};
    }

    if (typeof(eventOrId) === 'object') {
      eventOrId = eventOrId._id;
    }
    this.app.store('Event').remove(eventOrId, callback);
  },

  deleteExceptionEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }
    if (!callback) {
      callback = function() {};
    }

    this.icalComponents.get(event.parentId, (err, component) => {
      if (err) {
        return callback(err);
      }
      var vCalendar = ICAL.Component.fromString(component.ical);
      IcalHelper.addExDate(vCalendar, busytime.recurrenceId);
      var vExEvent = IcalHelper.getExEventByRecurId(vCalendar,
        busytime.recurrenceId);
      vCalendar.removeSubcomponent(vExEvent.component);
      component.ical = vCalendar.toString();

      // save iCalComponent after delete exception event and its busytime.
      this.events.remove(event._id, (err) => {
        if (err) {
          return callback(err);
        }
        this.icalComponents.persist(component, callback);
        this._deleteRecurEventIfNecessary(event.parentId);
      });
    });
  },

  deleteSingleEvent: function(event, busytime, callback) {
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
      var vCalendar = ICAL.Component.fromString(component.ical);
      IcalHelper.addExDate(vCalendar, busytime.recurrenceId);
      component.ical = vCalendar.toString();

      // save iCalComponent after delete current busytime.
      this.busytimes.remove(busytime._id, (err) => {
        if (err) {
          return callback(err);
        }
        this.icalComponents.persist(component, callback);
        this._deleteRecurEventIfNecessary(event._id);
      });
    });
  },

  deleteFutureEvents: function(startDate, event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }
    if (!callback) {
      callback = function() {};
    }
    var eventId = event._id;

    this.icalComponents.get(eventId, (err, component) => {
      if (err) {
        return callback(err);
      }
      var vCalendar = ICAL.Component.fromString(component.ical);
      var vEvent = IcalHelper.getFirstRecurEvent(vCalendar);
      var rRule = vEvent.component.getFirstPropertyValue('rrule');
      var until = new Date(startDate);
      // until day is included.
      until.setDate(until.getDate() - 1);
      rRule.until = until.toString('yyyy-MM-ddTHH:mm:ss');
      vEvent.component.updatePropertyWithValue('rrule', rRule);
      // remove all vExEvent after the date of until from vCalendar.
      IcalHelper.getAllFutureExEvent(vCalendar, until).forEach((vExEvent) => {
        vCalendar.removeSubcomponent(vExEvent.component);
      });
      component.ical = vCalendar.toString();

      // save icalComponent after delete all future busytimes
      // and exception events.
      Promise.all([
        this.busytimes.deleteFutureBusytimes(eventId, until),
        this.events.deleteFutureExEvents(eventId, until)
      ]).then((values) => {
        this.icalComponents.persist(component, callback);
        this._deleteRecurEventIfNecessary(eventId);
      }).catch((err) => {
        callback(err);
      });
    });
  },

  updateExceptionEvent: function(event, callback) {
    this.icalComponents.get(event.parentId, (err, component) => {
      if (err) {
        return callback(err);
      }
      if (!event.remote.isRecurring && event.remote.repeat === 'never') {
        var vCalendar = ICAL.Component.fromString(component.ical);
        var vEvent = IcalHelper.getExEventByRecurId(vCalendar,
          event.remote.recurrenceId);
        if (!vEvent) {
          return callback(new Error());
        }
        vEvent = IcalHelper.updateVEvent(vEvent, event);
        component.ical = vCalendar.toString();

        this.updateEvent(event, (err, busytime) => {
          if (err) {
            return callback(err);
          }
          this.icalComponents.persist(component, (err) => {
            if (err) {
              return callback(err);
            }
            callback(null, busytime);
          });
        });
      } else {
        this.createEvent(event, callback);
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

        callback(null, update.busytime);
      });
      return update;
    }
  },

  /**
   * update future event from startDate
   * If start date or all-day property is changed when update future event,
   * the properties of exDate and exEvent of the origin recurring event will
   * be ignored by the new created recurring event.
   *
   * @param {Date} startDate the start date for update.
   * @param {Object} event the event need to update.
   * @param {Object|Function} busytime.
   */
  updateEventAllFuture: function(startDate, event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }
    var eventId = event._id;
    this.icalComponents.get(eventId, (err, component) => {
      if (err) {
        return callback(err);
      }
      var vCalendar = ICAL.Component.fromString(component.ical);
      var vTimezoneComp = vCalendar.getFirstSubcomponent('vtimezone');
      var vTimezone = new ICAL.Timezone(vTimezoneComp);
      var vRecurEvent = IcalHelper.getFirstRecurEvent(vCalendar);
      var rRrule = vRecurEvent.component.getFirstPropertyValue('rrule');
      var until = new Date(startDate);
      until.setDate(until.getDate() - 1);
      rRrule.until = until.toString('yyyy-MM-ddTHH:mm:ss');
      vRecurEvent.component.updatePropertyWithValue('rrule', rRrule);

      var newStartDate = event.remote.startDate;
      var newEndDate = event.remote.endDate;
      var isDate = vRecurEvent.startDate.isDate;
      var isAllDay = Calc.isAllDay(newStartDate, newStartDate, newEndDate);
      var isSameDate = startDate.valueOf() === newStartDate.valueOf();
      var needExtraInfo = isSameDate && (isAllDay === isDate);

      var newCalendarString = IcalComposer.calendar(event);
      var vExEvents = IcalHelper.getAllExEvents(vCalendar);
      var vExDateProps = vRecurEvent.component.getAllProperties('exdate');
      var newVCalendar = ICAL.Component.fromString(newCalendarString);
      var newVRecurEvent = IcalHelper.getFirstRecurEvent(newVCalendar);
      vExEvents.forEach((vEvent) => {
        if (vEvent.recurrenceId.compare(newVRecurEvent.startDate) > 0) {
          vEvent.uid = newVRecurEvent.uid;
          vEvent.description = event.remote.description;
          vEvent.location = event.remote.location;
          vEvent.summary = event.remote.title;
          vEvent.sequence = vEvent.sequence + 1;
          if (needExtraInfo) {
            newVCalendar.addSubcomponent(vEvent.component);
          } else {
            vCalendar.removeSubcomponent(vEvent.component);
          }
        }
      });
      vExDateProps.forEach((vProp) => {
        var vDate = IcalHelper.getPropertyValue(vProp, vTimezone);
        if (vDate.compare(newVRecurEvent.startDate) > 0) {
          if (needExtraInfo) {
            newVRecurEvent.component.addProperty(vProp);
          } else {
            vRecurEvent.component.removeProperty(vProp);
          }
        }
      });
      component.ical = vCalendar.toString();

      // save icalComponent after delete all future busytimes and
      // exception events, and create a new recurring event after current date.
      var trans = this.app.db.transaction(
        ['events', 'busytimes', 'icalComponents'],
        'readwrite'
      );
      trans.addEventListener('complete', () => {
        this.icalComponents.persist(component, (err) => {
          if (err) {
            return callback(err);
          }
          this._simulateCaldavProcess(event, newVCalendar.toString(),
            callback);
          this._deleteRecurEventIfNecessary(eventId);
        });
      });
      trans.addEventListener('error', function(event) {
        if (callback) {
          callback(event);
        }
      });
      this.busytimes.deleteFutureBusytimes(eventId, until, trans);
      this.events.deleteFutureExEvents(eventId, until, trans);
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
      var vCalendar = ICAL.Component.fromString(component.ical);
      // add vExEvent to vCalendar.
      var vExEvent = IcalHelper.createVExEvent(event, parentModel);
      vCalendar.addSubcomponent(vExEvent.component);
      component.ical = vCalendar.toString();
      // add some properties to change the type of event
      // from normal to exception.
      event.remote.repeat = 'never';
      event.remote.isRecurring = false;
      event.remote.recurrenceId = IcalHelper.formatICALTime(
        vExEvent.recurrenceId
      );
      event.remote.isException = true;
      event.parentId = event._id;
      event._id = event.parentId + '-' + event.remote.recurrenceId.utc;
      // delete current busytime and create a new exception event,
      // and then persist iCalComponent.
      this.busytimes.remove(busytime._id, (err) => {
        if (err) {
          return callback(err);
        }
        this.createEvent(event, (err, busytime, event) => {
          if (err) {
            return callback(err);
          }
          this.icalComponents.persist(component, (err) => {
            if (err) {
              return callback(err);
            }
            callback(null, [busytime]);
          });
        });
      });
    });
  },

  updateEventToNormal: function(event, callback) {
    this.deleteEvent(event, (err, evt) => {
      if (err) {
        return callback(err);
      }
      this.createEvent(event, callback);
    });
  },

  _simulateCaldavProcess: function(event, ical, callback) {
    nextTick(() => {
      this.events.ownersOf(event, (err, owners) => {
        var monthSpan = Calc.spanOfTwoMonth(this.app.timeController.month);
        var stream = this.service.stream(
          'caldav',
          'streamEventsFromLocal',
          owners.account.toJSON(),
          owners.calendar.remote,
          {
            span: monthSpan,
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
                // need to put busytimes firest.
                callback(null,  busytimes, events, components);
              }
            }
          });
        });
      });
    });
  }
};

});
