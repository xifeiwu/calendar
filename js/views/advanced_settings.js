/* global softkeyHandler */
define(function(require, exports, module) {
'use strict';

var AlarmTemplate = require('templates/alarm');
var View = require('view');
var router = require('router');
var Local = require('provider/local');
var _ = navigator.mozL10n.get;

require('dom!advanced-settings-view');

function AdvancedSettings(options) {
  View.apply(this, arguments);
  this._initEvents();
  this.initHeader();
  this.calendarList = null;
  this.accountList = null;
}
module.exports = AdvancedSettings;

AdvancedSettings.prototype = {
  __proto__: View.prototype,

  selectors: {
    element: '#advanced-settings-view',
    setupCalendar: '#advanced-settings-view .sk-advs-setup-calendar',
    syncFrequencyContainer:
      '#advanced-settings-view .sk-advs-sync-frequency',
    syncFrequency: '#setting-sync-frequency',
    header: '#advanced-settings-header',
    standardAlarmLabel: '#default-event-alarm',
    alldayAlarmLabel: '#default-allday-alarm',
    defaultCalendar: '#advanced-settings-view select[name="defaultCalendar"]',
    defaultCalendarLocale: '#advanced-settings-view ' +
      'span[name="defaultCalendar-locale"]'
  },

  get setupCalendar() {
    return this._findElement('setupCalendar');
  },

  get syncFrequency() {
    return this._findElement('syncFrequency');
  },

  get syncFrequencyContainer() {
    return this._findElement('syncFrequencyContainer');
  },

  get standardAlarmLabel() {
    return this._findElement('standardAlarmLabel');
  },

  get alldayAlarmLabel() {
    return this._findElement('alldayAlarmLabel');
  },

  get standardAlarm() {
    return this.standardAlarmLabel.querySelector('select');
  },

  get alldayAlarm() {
    return this.alldayAlarmLabel.querySelector('select');
  },

  get defaultCalendar() {
    return this._findElement('defaultCalendar');
  },

  get defaultCalendarLocale() {
    return this._findElement('defaultCalendarLocale');
  },

  _formatModel: function(model) {
    // XXX: Here for l10n
    return {
      id: model._id,
      preset: model.preset,
      user: model.user,
      hasError: !!model.error
    };
  },

  _initEvents: function() {
    var setting = this.app.store('Setting');
    setting.on('syncFrequencyChange', this);
    setting.on('defaultCalendarChange', this);

    // XXX: disable sync function for now
    if (!this.app.isOnlineModificationEnable()) {
      this.syncFrequencyContainer.style.display = 'none';
    } else {
      this.syncFrequency.addEventListener('change', this);
    }

    this.standardAlarmLabel.addEventListener('change', this);
    this.alldayAlarmLabel.addEventListener('change', this);
    this.defaultCalendar.addEventListener('change', this);
  },

  _getAccounts: function() {
    return new Promise((resolve, reject) => {
      var store = this.app.store('Account');
      store.all().then((accounts) => {
        this.accountList = accounts;
        this._observeAccountStore();
        resolve();
      });
    });
  },

  _getCalendars: function() {
    return new Promise((resolve, reject) => {
      var store = this.app.store('Calendar');
      store.all().then((calendars) => {
        this.calendarList = calendars;
        this._observeCalendarStore();
        resolve();
      });
    });
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
          this.app.store('Setting').set('defaultCalendar', Local.calendarId);
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
    this._renderCalendarSelector();
  },

  _renderCalendarSelector: function() {
    this.defaultCalendar.innerHTML = '';
    var key = '';
    var groupNode = null;
    var name = '';
    for (key in this.accountList) {
      name = this.accountList[key].preset;
      groupNode = document.createElement('optgroup');
      groupNode.setAttribute('name', name);
      groupNode.label = _('preset-' + name);
      if (name === 'local') {
        this.defaultCalendar.insertBefore(groupNode,
          this.defaultCalendar.firstChild);
      } else {
        // XXX: ignore online account for now
        if (!this.app.isOnlineModificationEnable()) {
          continue;
        }
        this.defaultCalendar.appendChild(groupNode);
      }
    }

    var accountName = '';
    var accountSelector = '';
    var accountNode = null;
    var optionNode = null;
    var calendar = null;
    for (key in this.calendarList) {
      calendar = this.calendarList[key];
      accountName = this.accountList[calendar.accountId].preset;
      // XXX: ignore online calendar for now
      if (accountName !== 'local' && !this.app.isOnlineModificationEnable()) {
        continue;
      }
      accountSelector = 'optgroup[name="' + accountName + '"]';
      accountNode = this.defaultCalendar.querySelector(accountSelector);

      optionNode = document.createElement('option');
      optionNode.value = calendar._id;
      if (calendar._id === Local.calendarId) {
        name = _('calendar-local');
        optionNode.setAttribute('data-l10n-id', 'calendar-local');
      } else {
        name = calendar.remote.name;
      }
      optionNode.text = name;
      optionNode.setAttribute('full-name', accountNode.label + ' - ' + name);
      accountNode.appendChild(optionNode);
    }
    this.app.store('Setting').getValue('defaultCalendar', (err, value) => {
      if (err) {
        value = Local.calendarId;
      }
      this.defaultCalendar.value = value;
      this._renderCalendarLocale(value);
    });
  },

  handleSettingDbChange: function(type, value) {
    switch (type) {
      case 'syncFrequencyChange':
        this.syncFrequency.value = String(value);
        break;
      case 'defaultCalendarChange':
        this._renderCalendarLocale(value);
        break;
    }
  },

  handleSettingUiChange: function(type, value) {
    var store = this.app.store('Setting');
    // basic conversions
    if (value === 'null') {
      value = null;
    }

    switch (type) {
      case 'alldayAlarmDefault':
      case 'standardAlarmDefault':
      case 'syncFrequency':
        if (value !== null) {
          value = parseInt(value);
        }
        store.set(type, value);
        break;
      case 'defaultCalendar':
        store.set(type, value);
        break;
    }
  },

  handleEvent: function(event) {
    switch (event.type) {
      case 'change':
        var target = event.target;
        this.handleSettingUiChange(target.name, target.value);
        break;
      case 'syncFrequencyChange':
      case 'defaultCalendarChange':
        this.handleSettingDbChange(event.type, event.data[0]);
        break;
    }
  },

  handleKeyDownEvent: function(evt) {
    switch (evt.key) {
      case 'Enter':
      case 'Accept':
        break;
      case 'AcaSoftLeft':
        router.go('/month/');
        evt.preventDefault();
        break;
      case 'AcaSoftRight':
        break;
    }
  },

  initHeader: function() {
    softkeyHandler.register(this.setupCalendar, {
      dpe: {
        name: 'select',
        action: () => {
          router.go('/setup-calendar/');
          return false;
        }
      }
    });
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    this._keyDownHandler = this.handleKeyDownEvent.bind(this);
    window.addEventListener('keydown', this._keyDownHandler, false);
    this.element.focus();
  },

  oninactive: function() {
    View.prototype.oninactive.call(this, arguments);
    window.removeEventListener('keydown', this._keyDownHandler);
  },

  _renderCalendarLocale: function(value) {
    var selector = 'option[value="' + value + '"]';
    var optionSelected = this.defaultCalendar.querySelector(selector);
    this.defaultCalendarLocale.innerHTML =
      optionSelected.getAttribute('full-name');
  },

  render: function() {
    var self = this;
    var pending = 4;

    function next() {
      if (!--pending && self.onrender) {
        self.onrender();
      }
    }

    function renderSyncFrequency(err, value) {
      self.syncFrequency.value = String(value);
      next();
    }

    function renderAlarmDefault(type) {
      return function(err, value) {

        var element = type + 'AlarmLabel';
        var existing = self[element].querySelector('select');

        if (existing) {
          existing.parentNode.removeChild(existing);
        }

        // Render the select box
        var template = AlarmTemplate;
        var select = document.createElement('select');
        select.name = type + 'AlarmDefault';
        select.innerHTML = template.options.render({
          layout: type,
          trigger: value
        });
        self[element].querySelector('.button').appendChild(select);

        next();
      };
    }

    var settings = this.app.store('Setting');

    settings.getValue('syncFrequency', renderSyncFrequency);
    settings.getValue('standardAlarmDefault', renderAlarmDefault('standard'));
    settings.getValue('alldayAlarmDefault', renderAlarmDefault('allday'));

    Promise.all([this._getAccounts(), this._getCalendars()]).then(() => {
      this._renderCalendarSelector();
    })
    .catch((err) => {
      return console.error('Error fetching datebase.', err);
    });
  }
};

AdvancedSettings.prototype.onfirstseen = AdvancedSettings.prototype.render;

});
