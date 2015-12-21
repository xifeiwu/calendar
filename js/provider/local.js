/* global jstz */
define(function(require, exports, module) {
'use strict';

var Abstract = require('./abstract');
var mutations = require('event_mutations');
var uuid = require('ext/uuid');
var Calc = require('calc');
var CaldavPullEvents = require('provider/caldav_pull_events');
var nextTick = require('next_tick');

var LOCAL_CALENDAR_ID = 'local-first';

function Local() {
  Abstract.apply(this, arguments);

  // TODO: Get rid of this when app global is gone.
  mutations.app = this.app;
  this.service = this.app.serviceController;
  this.events = this.app.store('Event');
  this.busytimes = this.app.store('Busytime');
  this.alarms = this.app.store('Alarm');
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
    var list = {};
    list[LOCAL_CALENDAR_ID] = Local.defaultCalendar();
    callback(null, list);
  },

  syncEvents: function(account, calendar, cb) {
    cb(null);
  },

  calTimeOffset: function() {
    var d = new Date();
    var offset = d.getTimezoneOffset();
    var from = '00' + (Math.abs(offset) / 60) + '00';
    from = from.slice(-4);

    if (offset <= 0) {
      from = '+' + from;
    } else {
      from = '-' + from;
    }

    return from;
  },

  jointIcal: function(event) {
    var rule = '';
    switch (event.remote.repeat) {
      case 'every-day':
        rule = 'FREQ=DAILY;INTERVAL=1';
        break;
      case 'every-week':
        rule = 'FREQ=WEEKLY;INTERVAL=1';
        break;
      case 'every-2-weeks':
        rule = 'FREQ=WEEKLY;INTERVAL=2';
        break;
      case 'every-month':
        rule = 'FREQ=MONTHLY;INTERVAL=1';
        break;
      case 'every-year':
        rule = 'FREQ=YEARLY;INTERVAL=1';
        break;
    }
    var tzid = jstz.determine().name();
    var dtstart = new Date(event.remote.startDate).toString('yyyyMMddTHHmmss');
    var dtend = new Date(event.remote.endDate).toString('yyyyMMddTHHmmss');
    var dtstamp = new Date().toString('yyyyMMddTHHmmss');
    var offset = this.calTimeOffset();

    var ical = '';
    ical += 'BEGIN:VCALENDAR\r\n';
    ical += 'PRODID:-//H5OS//Calendar 1.0//EN\r\n';
    ical += 'VERSION:2.0\r\n';
    ical += 'CALSCALE:GREGORIAN\r\n';
    ical += 'BEGIN:VTIMEZONE\r\n';
    ical += 'TZID:' + tzid + '\r\n';
    ical += 'BEGIN:STANDARD\r\n';
    ical += 'TZOFFSETFROM:' + offset + '\r\n';
    ical += 'TZOFFSETTO:' + offset + '\r\n';
    ical += 'DTSTART;TZID=' + tzid + ':' + dtstart + '\r\n';
    ical += 'END:STANDARD\r\n';
    ical += 'END:VTIMEZONE\r\n';
    ical += 'BEGIN:VEVENT\r\n';
    ical += 'DTSTART;TZID=' + tzid + ':' + dtstart + '\r\n';
    ical += 'DTEND;TZID=' + tzid + ':' + dtend + '\r\n';
    ical += 'RRULE:' + rule + '\r\n';
    ical += 'DTSTAMP;TZID=' + tzid + ':' + dtstamp + '\r\n';
    ical += 'UID:' + event.remote.id + '\r\n';
    ical += 'DESCRIPTION:' + event.remote.description + '\r\n';
    ical += 'LOCATION:' + event.remote.location + '\r\n';
    ical += 'SEQUENCE:1\r\n';
    ical += 'STATUS:CONFIRMED\r\n';
    ical += 'SUMMARY:' + event.remote.title + '\r\n';
    ical += 'TRANSP:TRANSPARENT\r\n';
    ical += 'END:VEVENT\r\n';
    ical += 'END:VCALENDAR\r\n';

    return ical;
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

    var create = mutations.create({ event: event });
    if (event.remote.isRecurring) {
      create.icalComponent = {
        calendarId: LOCAL_CALENDAR_ID,
        eventId: LOCAL_CALENDAR_ID + '-' + event.remote.id,
        lastRecurrenceId: {
          tzid: jstz.determine().name(),
          offset: 0,
          utc: event.remote.start.utc,
          isDate: true
        },
        ical: this.jointIcal(event)
      };
    }

    create.commit(function(err) {
      if (err) {
        return callback(err);
      }

      callback(null, create.busytime, create.event);
    });

    return create;
  },

  deleteEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    this.app.store('Event').remove(event._id, callback);
  },

  deleteBusytime: function(busytimeId, callback) {
    this.app.store('Busytime').remove(busytimeId, callback);
  },

  /**
   * @return {Calendar.EventMutations.Update} mutation object.
   */
  updateEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    var update = mutations.update({ event: event });
    update.commit(function(err) {
      if (err) {
        return callback(err);
      }

      callback(null, update.busytime, update.event);
    });

    return update;
  },

  /**
   * To update a recurring event
   */
  updateEventAll: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    // to update a recurring event
    // 1. delete the event
    // 2. create a new event
    this.deleteEvent(event, function(err) {
      if (err) {
        return callback(err);
      }

      // to erase it's original id, and then
      // apply it a new id in creation
      nextTick(function() {
        delete event._id;
        delete event.remote.id;
        this.createEvent(event, callback);
      }.bind(this));
    }.bind(this));
  },

  /**
   * To update a single day of a recurring event
   */
  updateEventThisOnly: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    // to update a single day of a recurring event
    // 1. delete the busytime
    // 2. create a new event
    this.deleteBusytime(busytime, function(err) {
      if (err) {
        return callback(err);
      }

      // to erase it's original id, and then
      // apply it a new id in creation
      nextTick(function() {
        delete event._id;
        delete event.remote.id;
        this.createEvent(event, callback);
      }.bind(this));
    }.bind(this));
  },

  ensureRecurrencesExpanded: function(date, callback) {
    var self = this;
    var icalComponents = this.app.store('IcalComponent');
    icalComponents.findRecurrencesBefore(date, function(err, results) {
      if (err) {
        callback(err);
        return;
      }

      if (!results.length) {
        callback(null, false);
        return;
      }

      // CaldavPullRequest is based on a calendar/account combination
      // so we must group all of the outstanding components into
      // their calendars before we can begin expanding them.
      var groups = Object.create(null);
      results.forEach(function(comp) {
        var calendarId = comp.calendarId;
        if (!(calendarId in groups)) {
          groups[calendarId] = [];
        }

        groups[calendarId].push(comp);
      });

      var pullGroups = [];
      var pending = 0;
      var options = {
        maxDate: Calc.dateToTransport(date)
      };

      function next(err, pull) {
        pullGroups.push(pull);
        if (!(--pending)) {
          var trans = self.app.db.transaction(
            ['icalComponents', 'alarms', 'busytimes'],
            'readwrite'
          );

          trans.oncomplete = function() {
            callback(null, true);
          };

          trans.onerror = function(event) {
            callback(event.result.error.name);
          };

          pullGroups.forEach(function(pull) {
            pull.commit(trans);
          });
        }
      }

      for (var calendarId in groups) {
        pending++;
        self._expandComponents(
          calendarId,
          groups[calendarId],
          options,
          next
        );
      }

    });
  },

  _expandComponents: function(calendarId, comps, options, callback) {
    var calStore = this.app.store('Calendar');

    calStore.ownersOf(calendarId, function(err, owners) {
      if (err) {
        return callback(err);
      }

      var calendar = owners.calendar;
      var account = owners.account;

      var stream = this.service.stream(
        'caldav',
        'expandComponents',
        comps,
        options
      );

      var pull = new CaldavPullEvents(
        stream,
        {
          account: account,
          calendar: calendar,
          app: this.app,
          stores: [
            'busytimes', 'alarms', 'icalComponents'
          ]
        }
      );

      stream.request(function(err) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, pull);
      });

    }.bind(this));
  }
};

});
