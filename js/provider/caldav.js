define(function(require, exports, module) {
'use strict';

var Abstract = require('./abstract');
var Authentication = require('error').Authentication;
var Calc = require('calc');
var CaldavPullEvents = require('./caldav_pull_events');
var CalendarError = require('error');
var InvalidServer = require('error').InvalidServer;
var Local = require('./local');
var ServerFailure = require('error').ServerFailure;
var mutations = require('event_mutations');
var nextTick = require('next_tick');

var CALDAV_ERROR_MAP = {
  'caldav-authentication': Authentication,
  'caldav-invalid-entrypoint': InvalidServer,
  'caldav-server-failure': ServerFailure
};

function mapError(error, detail) {
  console.error('Error with name:', error.name);
  var calError = CALDAV_ERROR_MAP[error.name];
  if (!calError) {
    calError = new CalendarError(error.name, detail);
  } else {
    calError = new calError(detail);
  }

  return calError;
}

function CaldavProvider() {
  Abstract.apply(this, arguments);
}
module.exports = CaldavProvider;

CaldavProvider.prototype = {
  __proto__: Abstract.prototype,
  role: 'caldav',
  useUrl: true,
  useCredentials: true,
  canSync: true,
  canExpandRecurringEvents: true,

  /**
   * Number of dates in the past to sync.
   * This is usually from the first sync date.
   */
  daysToSyncInPast: 30,

  canCreateEvent: true,
  canUpdateEvent: true,
  canDeleteEvent: true,

  hasAccountSettings: true,

  /**
   * Error handling can be complex- this is the centralized location where
   * methods can send their error state and some context (an account).
   *
   *    this._handleServiceError(
   *      err,
   *      { account: account, calendar: calendar }
   *    );
   *
   * @param {Object} rawErr from service.
   * @param {Object} detail for the error.
   */
  _handleServiceError: function(rawErr, detail) {
    var calendarErr = mapError(rawErr, detail);

    // when we receive a permanent error we should mark the account with an
    // error.
    if (
      calendarErr instanceof Authentication ||
      calendarErr instanceof InvalidServer
    ) {
      // there must always be an account
      if (detail.account) {
        // but we only mark it with a permanent error if its persisted.
        if (detail.account._id) {
          this.accounts.markWithError(detail.account, calendarErr);
        }
      } else {
        console.error('Permanent server error without an account!');
      }
    }

    return calendarErr;
  },

  /**
   * Determines the capabilities of a specific calendar.
   *
   * The .remote property should contain a .privilegeSet array
   * with the caldav specific names of privileges.
   * In the case where .privilegeSet is missing all privileges are granted.
   *
   * (see http://tools.ietf.org/html/rfc3744#section-5.4).
   *
   *   - write-content: (PUT) can edit/add events
   *   - unbind: (DELETE) remove events
   *
   *
   * There are aggregate values (write for example) but
   * the spec states the specific permissions must also be expanded
   * so even if they have full write permissions we only check
   * for write-content.
   *
   * @param {Object} calendar object with caldav remote details.
   * @return {Object} object with three properties
   *  (canUpdate, canDelete, canCreate).
   */
  calendarCapabilities: function(calendar) {
    var remote = calendar.remote;

    if (!remote.privilegeSet) {
      return {
        canUpdateEvent: true,
        canDeleteEvent: true,
        canCreateEvent: true
      };
    }

    var privilegeSet = remote.privilegeSet;
    var canWriteConent = privilegeSet.indexOf('write-content') !== -1;

    return {
      canUpdateEvent: canWriteConent,
      canCreateEvent: canWriteConent,
      canDeleteEvent: privilegeSet.indexOf('unbind') !== -1
    };
  },

  /**
   * Returns the capabilities of a single event.
   *
   * @param {Object} event local object.
   * @param {Function} callback [err, caps].
   */
  eventCapabilities: function(event, callback) {
    if (event.remote.isRecurring) {
      // XXX: for now recurring events cannot be edited
      nextTick(function() {
        callback(null, {
          canUpdate: false,
          canDelete: false,
          canCreate: false
        });
      });

    } else {
      var calendarStore = this.app.store('Calendar');

      calendarStore.get(event.calendarId, function(err, calendar) {
        if (err) {
          return callback(err);
        }

        var caps = this.calendarCapabilities(
          calendar
        );

        callback(null, {
          canCreate: caps.canCreateEvent,
          canUpdate: caps.canUpdateEvent,
          canDelete: caps.canDeleteEvent
        });
      }.bind(this));
    }
  },

  getAccount: function(account, callback) {
    if (this.bailWhenOffline(callback)) {
      return;
    }

    var self = this;
    this.service.request(
      'caldav',
      'getAccount',
      account,
      function(err, data) {
        if (err) {
          return callback(
            self._handleServiceError(err, { account: account })
          );
        }
        callback(null, data);
      }
    );
  },

  /**
   * Hook to format remote data if needed.
   */
  formatRemoteCalendar: function(calendar) {
    if (!calendar.color) {
      calendar.color = this.defaultColor;
    }

    return calendar;
  },

  findCalendars: function(account, callback) {
    if (this.bailWhenOffline(callback)) {
      return;
    }

    var self = this;
    function formatCalendars(err, data) {
      if (err) {
        return callback(self._handleServiceError(err, {
          account: account
        }));
      }

      // format calendars if needed
      if (data) {
        for (var key in data) {
          data[key] = self.formatRemoteCalendar(data[key]);
        }
      }

      callback(err, data);
    }

    this.service.request(
      'caldav',
      'findCalendars',
      account.toJSON(),
      formatCalendars
    );
  },

  _syncEvents: function(account, calendar, cached, callback) {

    var startDate;
    // calculate the first date we want to sync
    if (!calendar.firstEventSyncDate) {
      startDate = Calc.createDay(new Date());

      // will be persisted if sync is successful (clone is required)
      calendar.firstEventSyncDate = new Date(
        startDate.valueOf()
      );
    } else {
      startDate = new Date(calendar.firstEventSyncDate.valueOf());
    }

    // start date - the amount of days is the sync range
    startDate.setDate(startDate.getDate() - this.daysToSyncInPast);

    var options = {
      startDate: startDate,
      cached: cached
    };

    var stream = this.service.stream(
      'caldav',
      'streamEvents',
      account.toJSON(),
      calendar.remote,
      options
    );

    var pull = new CaldavPullEvents(stream, {
      app: this.app,
      account: account,
      calendar: calendar
    });

    var calendarStore = this.app.store('Calendar');
    var syncStart = new Date();

    var self = this;
    stream.request(function(err) {
      if (err) {
        return callback(
          self._handleServiceError(err, {
            account: account,
            calendar: calendar
          })
        );
      }

      var trans = pull.commit(function(commitErr) {
        if (commitErr) {
          callback(err);
          return;
        }
        callback(null);
      });

      /**
       * Successfully synchronizing a calendar indicates we can remove this
       * error.
       */
      calendar.error = undefined;

      calendar.lastEventSyncToken = calendar.remote.syncToken;
      calendar.lastEventSyncDate = syncStart;

      calendarStore.persist(calendar, trans);

    });

    return pull;
  },

  /**
   * Builds list of event urls & sync tokens.
   *
   * @param {Calendar.Model.Calendar} calender model instance.
   * @param {Function} callback node style [err, results].
   */
  _cachedEventsFor: function(calendar, callback) {
    var store = this.app.store('Event');

    store.eventsForCalendar(calendar._id, function(err, results) {
      if (err) {
        callback(err);
        return;
      }

      var list = Object.create(null);

      var i = 0;
      var len = results.length;
      var item;

      for (; i < len; i++) {
        item = results[i];
        list[item.remote.url] = {
          syncToken: item.remote.syncToken,
          id: item._id
        };
      }

      callback(null, list);
    });
  },

  /**
   * Sync remote and local events for a calendar.
   */
  syncEvents: function(account, calendar, callback) {
    var self = this;

    if (this.bailWhenOffline(callback)) {
      return;
    }

    if (!calendar._id) {
      throw new Error('calendar must be assigned an _id');
    }

    // Don't attempt to sync when provider cannot
    // or we have matching tokens
    if ((calendar.lastEventSyncToken &&
         calendar.lastEventSyncToken === calendar.remote.syncToken)) {
      return nextTick(callback);
    }

    this._cachedEventsFor(calendar, function(err, results) {
      if (err) {
        callback(err);
        return;
      }

      self._syncEvents(
        account,
        calendar,
        results,
        callback
      );
    });
  },

  createEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }


    if (this.bailWhenOffline(callback)) {
      return;
    }

    this.events.ownersOf(event, fetchOwners);

    var self = this;
    var calendar;
    var account;
    function fetchOwners(err, owners) {
      calendar = owners.calendar;
      account = owners.account;

      self.service.request(
        'caldav',
        'createEvent',
        account,
        calendar.remote,
        event.remote,
        handleRequest
      );
    }

    function handleRequest(err, remote) {
      if (err) {
        return callback(self._handleServiceError(err, {
          account: account,
          calendar: calendar
        }));
      }

      var event = {
        _id: calendar._id + '-' + remote.id,
        calendarId: calendar._id
      };

      var component = {
        eventId: event._id,
        ical: remote.icalComponent
      };

      delete remote.icalComponent;
      event.remote = remote;

      var create = mutations.create({
        event: event,
        icalComponent: component
      });

      create.commit(function(err) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, create.busytime, create.event);
      });
    }
  },

  updateEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    if (this.bailWhenOffline(callback)) {
      return;
    }

    this.events.ownersOf(event, fetchOwners);

    var self = this;
    var calendar;
    var account;

    function fetchOwners(err, owners) {
      calendar = owners.calendar;
      account = owners.account;

      self.icalComponents.get(
        event._id, fetchComponent
      );
    }

    function fetchComponent(err, ical) {
      if (err) {
        callback(err);
        return;
      }

      var details = {
        event: event.remote,
        icalComponent: ical.ical
      };

      self.service.request(
        'caldav',
        'updateEvent',
        account,
        calendar.remote,
        details,
        handleUpdate
      );
    }

    function handleUpdate(err, remote) {
      if (err) {
        callback(self._handleServiceError(err, {
          account: account,
          calendar: calendar
        }));
        return;
      }

      var component = {
        eventId: event._id,
        ical: remote.icalComponent
      };

      delete remote.icalComponent;
      event.remote = remote;

      var update = mutations.update({
        event: event,
        icalComponent: component
      });

      update.commit(function(err) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, update.busytime, update.event);
      });
    }
  },

  deleteEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    if (this.bailWhenOffline(callback)) {
      return;
    }

    this.events.ownersOf(event, fetchOwners);

    var calendar;
    var account;
    var self = this;
    function fetchOwners(err, owners) {
      calendar = owners.calendar;
      account = owners.account;

      self.service.request(
        'caldav',
        'deleteEvent',
        account,
        calendar.remote,
        event.remote,
        handleRequest
      );

    }

    function handleRequest(err) {
      if (err) {
        callback(self._handleServiceError(err, {
          account: account,
          calendar: calendar
        }));
        return;
      }
      Local.prototype.deleteEvent.call(self, event, busytime, callback);
    }
  },

  bailWhenOffline: function(callback) {
    if (!this.offlineMessage && 'mozL10n' in window.navigator) {
      this.offlineMessage = window.navigator.mozL10n.get('error-offline');
    }

    var ret = this.app.offline() && callback;
    if (ret) {
      var error = new Error();
      error.name = 'offline';
      error.message = this.offlineMessage;
      callback(error);
    }
    return ret;
  }
};

});
