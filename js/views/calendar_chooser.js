/* globals SoftkeyHandler */
define(function(require, exports, module) {
'use strict';

var CalendarTemplate = require('templates/calendar_chooser');
var View = require('view');
var debug = require('debug')('calendar_chooser');
var forEach = require('object').forEach;
var Responder = require('responder');
require('dom!calendar-chooser-view');

function CalendarChooser(options) {
  View.apply(this, arguments);
  this.calendarList = {};
  this._updateTimeouts = Object.create(null);
  this._checkBoxs = [];
  this._checkState = {};
  this.event = new Responder();
}
module.exports = CalendarChooser;

CalendarChooser.prototype = {
  __proto__: View.prototype,

  calendarList: null,
  accountList: null,
  _checkState: null,
  _checkBoxs: null,

  WAIT_BEFORE_PERSIST: 600,

  selectors: {
    element: '#calendar-chooser-view',
    header: '#calendar-chooser-view .calendar-chooser-header',
    calendars: '#calendar-chooser-view .calendars',
  },

  get header() {
    return this._findElement('header');
  },

  get calendars() {
    return this._findElement('calendars');
  },

  _persistCalendarDisplay: function(id, displayed) {
    var store = this.app.store('Calendar');
    var self = this;

    // clear timeout id
    delete this._updateTimeouts[id];

    function persist(err, id, model) {
      if (err) {
        return console.error('Cannot save calendar', err);
      }

      if (self.ondisplaypersist) {
        self.ondisplaypersist(model);
      }
    }

    function fetch(err, calendar) {
      if (err) {
        return console.error('Cannot fetch calendar', id);
      }

      calendar.localDisplayed = displayed;
      store.persist(calendar, persist);
    }

    store.get(id, fetch);
  },

  _addAccountToDOM: function(type, account) {
    var id = account._id;
    var name = account.preset;
    var upperCaseName = name.toUpperCase();
    var localesName = 'preset-' + name;
    var html = `
      <div class=${localesName} account-id=${id}>
        <h5-separator data-l10n-id=${localesName}>
          ${upperCaseName}</h5-separator>
        <ul>
        </ul>
      </div>`;
    this.calendars.insertAdjacentHTML(type, html);
  },

  render: function() {
    var self = this;

    this.calendars.innerHTML = '';
    for (var key in this.accountList) {
      if (this.accountList[key].preset === 'local') {
        this._addAccountToDOM('afterbegin', this.accountList[key]);
      } else {
        this._addAccountToDOM('beforeend', this.accountList[key]);
      }
    }
    forEach(this.calendarList, function(id, object) {
      var html = CalendarTemplate.item.render(object);
      var category = this.accountList[object.accountId].preset;
      if (category) {
        this.calendars.querySelector('.preset-' + category + ' ul')
          .insertAdjacentHTML('beforeend', html);
      }
    }.bind(this), this);

    var result = this.calendars.querySelectorAll('h5-checkbox');
    if (result) {
      this._checkBoxs = Array.prototype.slice.call(result);
      this._checkBoxs.forEach((checkbox) => {
        this._checkState[checkbox.value] = checkbox.checked;
        SoftkeyHandler.register(checkbox, {
          lsk: {
            name: 'cancel',
            action: () => {
              self.hide();
            }
          },
          rsk: {
            name: 'ok',
            action: () => {
              self._onSelectCalendar();
            }
          }
        });
      });
    }
  },

  _onSelectCalendar: function() {
    this._checkBoxs.forEach((checkbox) => {
      var id = checkbox.value;
      var state = checkbox.checked;
      if (state !== this._checkState[id]) {
        this._persistCalendarDisplay(id, state);
      }
    });
    this.hide();
  },

  _observeAccountStore: function() {
    var store = this.app.store('Account');
    // account store events
    store.on('add', this._dbListener.bind(this, 'account', 'add'));
    store.on('remove', this._dbListener.bind(this, 'account', 'remove'));
  },

  _observeCalendarStore: function() {
    var store = this.app.store('Calendar');
    // calendar store events
    store.on('add', this._dbListener.bind(this, 'calendar', 'add'));
    store.on('update', this._dbListener.bind(this, 'calendar', 'update'));
    store.on('remove', this._dbListener.bind(this, 'calendar', 'remove'));
  },

  _dbListener: function(dbName, operation, id, model) {
    switch (dbName) {
      case 'calendar':
        if (operation === 'add' || operation === 'update') {
          this.calendarList[id] = model;
        } else if (operation === 'remove') {
          delete this.calendarList[id];
        }
        break;
      case 'account':
        if (operation === 'add') {
          this.accountList[id] = model;
        } else if (operation === 'remove') {
          delete this.accountList[id];
        }
        break;
    }
  },

  _getAccounts: function() {
    return new Promise((resolve, reject) => {
      if (this.accountList && Object.keys(this.accountList).length) {
        resolve();
      } else {
        var store = this.app.store('Account');
        store.all().then((accounts) => {
          this.accountList = accounts;
          this._observeAccountStore();
        })
        .then(resolve());
      }
    });
  },

  _getCalendars: function() {
    return new Promise((resolve, reject) => {
      if (this.calendarList && Object.keys(this.calendarList).length) {
        resolve();
      } else {
        var store = this.app.store('Calendar');
        store.all().then((calendars) => {
          this.calendarList = calendars;
          // observe new calendar events
          this._observeCalendarStore();
        })
        .then(() => {
          var _calendar, _remote, _id, _key;
          for (_id in this.calendarList) {
            _calendar = this.calendarList[_id];
            if (_calendar.remote) {
              _remote = _calendar.remote;
              for (_key in _remote) {
                _calendar[_key] = _remote[_key];
              }
            }
          }
          resolve();
        });
      }
    });
  },

  show: function() {
    this.onactive();
  },

  onactive: function() {
    // If we haven't yet cached idb calendars, do that now.
    Promise.all([this._getAccounts(), this._getCalendars()]).then(() => {
      // View#onactive will call Views.Settings#render the first time.
      View.prototype.onactive.apply(this, arguments);
      this.calendars.style.maxHeight = (document.body.clientHeight -
        this.header.getBoundingClientRect().height) + 'px';
      this.render();
      this.calendars.focus();
    })
    .catch((err) => {
      return console.error('Error fetching datebase.', err);
    });
  },

  hide: function() {
    this.oninactive();
    this.event.emit('hide');
  },

  oninactive: function() {
    View.prototype.oninactive.call(this);
  },
};

});
