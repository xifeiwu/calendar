define(function(require, exports, module) {
'use strict';

var denodeifyAll = require('promise').denodeifyAll;
var nextTick = require('next_tick');
var Calc = require('calc');
var CaldavPullEvents = require('./caldav_pull_events');
var mutations = require('event_mutations');

function Abstract(options) {
  var key;
  for (key in options) {
    if (options.hasOwnProperty(key)) {
      this[key] = options[key];
    }
  }

  // TODO: Get rid of this when app global is gone.
  mutations.app = this.app;
  this.service = this.app.serviceController;
  this.accounts = this.app.store('Account');
  this.busytimes = this.app.store('Busytime');
  this.events = this.app.store('Event');
  this.icalComponents = this.app.store('IcalComponent');

  denodeifyAll(this, [
    'eventCapabilities',
    'getAccount',
    'findCalendars',
    'syncEvents',
    'ensureRecurrencesExpanded',
    'createEvent',
    'updateEvent',
    'deleteEvent'
  ]);
}
module.exports = Abstract;

Abstract.prototype = {
  // orange (used by local calendar)
  defaultColor: '#F97C17',

  /**
   * Does this provider require credentials.
   */
  useCredentials: false,

  /**
   * Does this provider require a url.
   */
  useUrl: false,

  /**
   * Can provider sync with remote server?
   */
  canSync: false,

  /**
   * Can expand recurring events?
   */
  canExpandRecurringEvents: false,

  /**
   *  - domain: (String)
   *  - password: (String)
   *  - user: (String)
   *
   * @param {Object} account user credentials.
   * @param {Function} callback node style (err, result).
   */
  getAccount: function(account, callback) {},

  /**
   * Attempts to find all calendars
   * for a given account.
   *
   *
   * account: (same as getAccount)
   *
   * @param {Object} account user credentials.
   * @param {Function} callback node style (err, result).
   */
  findCalendars: function() {},

  /**
   * Sync remote and local events.
   *
   */
  syncEvents: function(account, calendar, callback) {},

  /**
   * Ensures recurring events are expanded up to the given date.
   *
   * Its very important to correctly return the second callback arg
   * in the subclasses callback. When requiredExpansion is returned as true a
   * second call will likely be made to ensureRecurrencesExpanded to verify
   * there are no more pending events for the date (controller handles this).
   *
   * @param {Date} date to expand recurring events to.
   * @param {Function} callback [err, requiredExpansion].
   *  first argument is error, second indicates if any expansion was done.
   */

  /**
   * XXX:
   *  since local provider need to calculate recurring events too,
   *  so move the implementation from caldav provider to abstract.
   */
  /**
   * See abstract for contract details...
   *
   * Finds all ical components that have not been expanded
   * beyond the given point and expands / persists them.
   *
   * @param {Date} maxDate maximum date to expand to.
   * @param {Function} callback [err, didExpand].
   */
  ensureRecurrencesExpanded: function(maxDate, callback) {
    var self = this;
    this.icalComponents.findRecurrencesBefore(maxDate,
                                              function(err, results) {
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
        maxDate: Calc.dateToTransport(maxDate)
      };

      function next(err, pull) {
        if (!err && pull) {
          pullGroups.push(pull);
        }
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
      // Donot check it for now
      // if (owners.account.providerType !== 'Caldav') {
      //   return callback('Not Caldav provider');
      // }

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
  },

  expandRecurrences: function(expandSpan, callback) {
    this.icalComponents.findRecurrencesBySpan(expandSpan,
      (err, results) => {
        if (err) {
          callback(err);
          return;
        }

        if (!results.length) {
          callback(null, false);
          return;
        }

        results.forEach((component) => {
          this._expandComponent(component);
        });
        callback(null, true);
      }
    );
  },

  _expandComponent: function(comp) {
    var calendarId = comp.calendarId;
    if (!comp.ical || !comp.toSpan) {
      return;
    }
    var calStore = this.app.store('Calendar');

    calStore.ownersOf(calendarId, function(err, owners) {
      if (err) {
        return;
      }

      var calendar = owners.calendar;
      var account = owners.account;

      var stream = this.service.stream(
        'caldav',
        'expandComponent',
        {
          ical: comp.ical,
          span: comp.toSpan
        }
      );

      var pull = new CaldavPullEvents(
        stream,
        {
          account: account,
          calendar: calendar,
          app: this.app,
          stores: [
            'busytimes', 'icalComponents'
          ]
        }
      );
      stream.request(function(err) {
        if (err) {
          return;
        }
        pull.commit(() => {});
      });

    }.bind(this));
  },

  /**
   * Update an event
   *
   * @param {Object} event record from event store.
   *
   * @param {Object} [busytime] optional busytime instance
   *                 when a busytime is passed the edit is treated
   *                 as an "exception" and will only edit the one recurrence
   *                 related to the busytime. This may result in the creation
   *                 of a new "event" related to the busytime.
   */
  updateEvent: function(event, busytime, callback) {},

  /**
   * Delete event
   *
   * @param {Object} event record from the event store.
   * @param {Object} [busytime] optional busytime instance
   *                 when given it will only remove this occurence/exception
   *                 of the event rather then the entire sequence of events.
   */
  deleteEvent: function(event, busytime, callback) {},

  /**
   * Create an event
   */
  createEvent: function(event, callback) {},

  /**
   * Returns an object with three keys used to
   * determine the capabilities of a given calendar.
   *
   * - canCreate (Boolean)
   * - canUpdate (Boolean)
   * - canDelete (Boolean)
   *
   * @param {Object} calendar full calendar details.
   */
  calendarCapabilities: function(calendar) {
    return {
      canCreateEvent: true,
      canUpdateEvent: true,
      canDeleteEvent: true
    };
  },

  /**
   * Returns the capabilities of a single event.
   *
   * @param {Object} event object.
   * @param {Function} callback [err, caps].
   */
  eventCapabilities: function(event, callback) {
    var caps = this.calendarCapabilities();

    nextTick(function() {
      callback(null, {
        canCreate: caps.canCreateEvent,
        canUpdate: caps.canUpdateEvent,
        canDelete: caps.canDeleteEvent
      });
    });
  }
};

});
