define(function(require, exports, module) {
'use strict';

var Event = require('models/event');
var View = require('view');
var dayObserver = require('day_observer');
var nextTick = require('next_tick');
var providerFactory = require('provider/provider_factory');
var router = require('router');

function EventBase(options) {
  View.apply(this, arguments);

  this.store = this.app.store('Event');
  this.busytimeStore = this.app.store('Busytime');
  this.timeController = this.app.timeController;
  this.optionMenuController = this.app.optionMenuController;
  this.dialogController = this.app.dialogController;

  this._els = Object.create(null);
  this._changeToken = 0;

  this.cancel = this.cancel.bind(this);
  this.primary = this.primary.bind(this);
  this.busytimeId = null;
  this._initEvents();
}
module.exports = EventBase;

EventBase.prototype = {
  __proto__: View.prototype,

  READONLY: 'readonly',
  CREATE: 'create',
  UPDATE: 'update',
  PROGRESS: 'in-progress',
  ALLDAY: 'allday',
  LOADING: 'loading',

  DEFAULT_VIEW: '/month/',

  _initEvents: function() {},

  uiSelector: '.%',

  get header() {
    return this._findElement('header');
  },

  get fieldRoot() {
    return this.element;
  },

  /**
   * Returns the url the view will "redirect" to
   * after completing the current add/edit/delete operation.
   *
   * @return {String} redirect url.
   */
  returnTo: function() {
    var path = this._returnTo || this.DEFAULT_VIEW;
    return path;
  },

  /**
   * Returns the top level URL, or returnTo()
   * Resets the returnTop variable so we can override on next visit
   */
  returnTop: function() {
    var path = this._returnTop || this.returnTo();
    delete this._returnTop;
    return path;
  },

  /**
   * Dismiss modification and go back to previous screen.
   */
  cancel: function() {
    window.history.back();
  },

  /**
   * This method is overridden
   */
  primary: function() {},

  /**
   * This method is overridden
   */
  _markReadonly: function() {},

  /**
   * When the event is something like this:
   * 2012-01-02 and we detect this is an all day event
   * we want to display the end date like this 2012-01-02.
   */
  formatEndDate: function(endDate) {
    if (
      endDate.getHours() === 0 &&
      endDate.getSeconds() === 0 &&
      endDate.getMinutes() === 0
    ) {
      // subtract the date to give the user a better
      // idea of which dates the event spans...
      endDate = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate() - 1
      );
    }

    return endDate;
  },

  /**
   * Assigns and displays event & busytime information.
   * Marks view as "loading"
   *
   * @param {Object} busytime for view.
   * @param {Object} event for view.
   * @param {Function} [callback] optional callback.
   */
  useModel: function(busytime, event, callback) {
    // mark view with loading class
    var classList = this.element.classList;
    classList.add(this.LOADING);

    this.event = new Event(event);
    this.busytime = busytime;

    var changeToken = ++this._changeToken;

    var self = this;

    this.store.ownersOf(event, fetchOwners);

    function fetchOwners(err, owners) {
      if (owners.account.providerType === 'Local') {
        self.isLocal = true;
      } else {
        self.isLocal = false;
      }
      self.originalCalendar = owners.calendar;
      self.provider = providerFactory.get(owners.account.providerType);
      self.provider.eventCapabilities(
        self.event,
        fetchEventCaps
      );
    }

    function fetchEventCaps(err, caps) {
      if (self._changeToken !== changeToken) {
        return;
      }

      if (err) {
        console.error('Failed to fetch events capabilities', err);

        if (callback) {
          classList.remove(self.LOADING);
          callback(err);
        }

        return;
      }

      if (!caps.canUpdate) {
        self._markReadonly(true);
        self.element.classList.add(self.READONLY);
      }

      // inheritance hook...
      self._updateUI();

      // we only remove the loading class after the UI is rendered just to
      // avoid potential race conditions during marionette tests (trying to
      // read the data before it's on the DOM)
      classList.remove(self.LOADING);

      if (callback) {
        callback();
      }
    }
  },

  /** override me! **/
  _updateUI: function() {},

  /**
   * Loads event and triggers form update.
   * Gracefully will handle race conditions
   * if rapidly switching between events.
   * TODO: This token may no longer be needed
   *   as we have an aria-disabled guard now.
   *
   * @param {String} id busytime id.
   */
  _loadModel: function(id, callback) {
    var self = this;
    var token = ++this._changeToken;
    var classList = this.element.classList;

    classList.add(this.LOADING);

    this.busytimeId = id;
    dayObserver.findAssociated(id).then(record => {
      if (token === self._changeToken) {
        self.useModel(
          record.busytime,
          record.event,
          callback
        );
      } else {
        // ensure loading is removed
        classList.remove(this.LOADING);
      }
    })
    .catch(() => {
      classList.remove(this.LOADING);
      console.error('Error looking up records for id: ', id);
      router.go(this.returnTop());
    });
  },

  /**
   * Builds and sets defaults for a new model.
   *
   * @return {Calendar.Models.Model} new model.
   */
  _createModel: function(time) {
    // time can be null in some cases, default to today (eg. unit tests)
    time = time || new Date();

    this._setDefaultHour(time);

    var model = new Event();
    model.startDate = time;

    var end = new Date(time.valueOf());
    end.setHours(end.getHours() + 1);

    model.endDate = end;

    return model;
  },

  _setDefaultHour: function(date) {
    var now = new Date();
    date.setHours(now.getHours() + 1, 0, 0, 0);
  },

  /**
   * Gets and caches an element by selector
   */
  getEl: function(name) {
    if (!(name in this._els)) {
      var el = this.fieldRoot.querySelector(
        this.uiSelector.replace('%', name)
      );
      if (el) {
        this._els[name] = el;
      }
    }
    return this._els[name];
  },

  oninactive: function() {
    View.prototype.oninactive.apply(this, arguments);
    this.busytimeId = null;
  },

  _getProviderAndCheckCaps: function(event, cap, callback) {
    this.store.ownersOf(event, (err, owners) => {
      var provider = providerFactory.get(owners.account.providerType);
      provider.eventCapabilities(
        event,
        (err, caps) => {
          if (err) {
            return callback(err);
          }

          if (!caps[cap]) {
            return callback(new Error('Capability ' + cap + ' not allowed!!!'));
          } else {
            callback(null, provider);
          }
        }
      );
    });
  },

  _getEventByBusytime: function(busytimeId, callback) {
    dayObserver.findAssociated(busytimeId).then(record => {
      callback(null, record.event, record.busytime);
    }).catch(() => {
      callback(new Error('findAssociated failed!!!'));
    });
  },

  _deleteEvent: function(method, busytimeId, callback) {
    this._getEventByBusytime(busytimeId, (err, event, busytime) => {
      if (err) {
        return callback(err);
      }

      this._getProviderAndCheckCaps(event, 'canDelete', (err, provider) => {
        if (err) {
          return callback(err);
        }
        switch (method) {
          case 'deleteEvent':
            if (event.remote.isException) {
              provider.deleteExceptionEvent(event, busytime, callback);
            } else {
              provider.deleteEvent(event, callback);
            }
            break;
          case 'deleteFutureEvents':
            provider.deleteFutureEvents(busytime.startDate, event, callback);
            break;
          case 'deleteSingleEvent':
            provider.deleteSingleEvent(event, busytime, callback);
            break;
        }
      });
    });
  },

  deleteEvent: function(busytimeId, callback) {
    this._deleteEvent('deleteEvent', busytimeId, callback);
  },

  deleteSingleEvent: function(busytimeId, callback) {
    this._deleteEvent('deleteSingleEvent', busytimeId, callback);
  },

  deleteFutureEvents: function(busytimeId, callback) {
    this._deleteEvent('deleteFutureEvents', busytimeId, callback);
  },

  /**
   * Handles the url parameters for when this view
   * comes into focus.
   *
   * When the (busytime) id parameter is given the event will
   * be found via the time controller.
   */
  dispatch: function(data) {
    // always remove loading initially (to prevent worst case)
    this.element.classList.remove(this.LOADING);

    var id = data.params.id;
    var classList = this.element.classList;
    var last = router.last;

    if (last && last.path) {
      if (!(/^\/(day|event|month|week|alarm)/.test(last.path))) {
        // We came from some place suspicious so fall back to default.
        this._returnTo = this.DEFAULT_VIEW;
      } else {
        // Return to the default view if we just added an event.
        // Else go back to where we came from.
        this._returnTo = /^\/event\/add\//.test(last.path) ?
            this.DEFAULT_VIEW : last.path;
      }
    }

    if (!this._returnTop && this._returnTo) {
      this._returnTop = this._returnTo;
    }

    var self = this;
    function completeDispatch() {
      if (self.ondispatch) {
        self.ondispatch(data.params);
      }
    }

    if (id) {
      classList.add(this.UPDATE);

      this._loadModel(id, completeDispatch);
    } else {
      if (/^\/event\/add\//.test(router.canonicalPath)) {
        classList.add(this.CREATE);
        var controller = this.app.timeController;
        this.event = this._createModel(controller.mostRecentDay);
        this._updateUI();
        this.app.store('Setting').getValue('defaultCalendar',
          (err, value) => {
            if (err) {
              return console.error('get defaultCalendar fail:' + err);
            }
            this.event.calendarId = value;
            this._updateUI();
          }
        );
        nextTick(completeDispatch);
      } else if (/^\/event\/list\//.test(router.canonicalPath)) {
        completeDispatch();
      }
    }

  },

  onfirstseen: function() {}

};

});
