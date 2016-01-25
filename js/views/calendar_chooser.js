/* globals softkeyHandler */
define(function(require, exports, module) {
'use strict';

var template = require('templates/calendar_chooser');
var View = require('view');
var Responder = require('responder');
var debug = require('debug')('calendar_chooser');
require('dom!calendar-chooser-view');

function CalendarChooser(options) {
  View.apply(this, arguments);
  this._updateTimeouts = Object.create(null);
  this._checkBoxs = [];
  this._checkState = {};
  this.event = new Responder();

  this.dbListener = this.app.dbListener;
  this.allAccounts = this.dbListener.getAllAccounts();
  this.allCalendars = this.dbListener.getAllCalendars();
  this._render();
  this.dbListener.on('calendar-change', (calendars) => {
    this.allCalendars = calendars;
    this._render();
  });
  this.dbListener.on('account-change', (accounts) => {
    this.allAccounts = accounts;
    this._render();
  });
}
module.exports = CalendarChooser;

CalendarChooser.prototype = {
  __proto__: View.prototype,

  _checkState: null,
  _checkBoxs: null,

  WAIT_BEFORE_PERSIST: 600,

  selectors: {
    element: '#calendar-chooser-view',
    header: '#calendar-chooser-view .calendar-chooser-header',
    contents: '#calendar-chooser-view .contents',
  },

  get contents() {
    return this._findElement('contents');
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

  _render: function() {
    var self = this;

    this.contents.innerHTML = '';
    this.allAccounts.forEach(account => {
      this.contents.insertAdjacentHTML('beforeend',
        template.account.render(account));
    });
    this.allCalendars.forEach(calendar => {
      var selector = 'div[account-id="' + calendar.accountId + '"] ul';
      var accountNode = this.contents.querySelector(selector);
      if (accountNode) {
        calendar.name = calendar.remote.name;
        accountNode.insertAdjacentHTML('beforeend',
          template.calendar.render(calendar));
      }
    });

    var result = this.contents.querySelectorAll('h5-checkbox');
    if (result) {
      this._checkBoxs = Array.prototype.slice.call(result);
      this._checkBoxs.forEach((checkbox) => {
        this._checkState[checkbox.value] = checkbox.checked;
        softkeyHandler.register(checkbox, {
          lsk: {
            name: 'cancel',
            action: () => {
              self.hide();
              return false;
            }
          },
          rsk: {
            name: 'ok',
            action: () => {
              self._onSelectCalendar();
              return false;
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

  show: function() {
    this.onactive();
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    this.contents.style.maxHeight = (document.body.clientHeight -
      this.header.getBoundingClientRect().height) + 'px';
    this.contents.focus();
  },

  hide: function() {
    this.oninactive();
    this.event.emit('hide');
  },

  oninactive: function() {
    View.prototype.oninactive.call(this, arguments);
  }
};

});
