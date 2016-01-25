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
  this.settingStore = this.app.store('Setting');
  this._initEvents();
  this.initHeader();

  this.dbListener = this.app.dbListener;
  this.allAccounts = this.dbListener.getAllAccounts();
  this.allCalendars = this.dbListener.getAllCalendars();
  this._renderCalendarSelector();
  this.dbListener.on('calendar-change', (calendars) => {
    this.allCalendars = calendars;
    this._renderCalendarSelector();
  });
  this.dbListener.on('account-change', (accounts) => {
    this.allAccounts = accounts;
    this._renderCalendarSelector();
  });
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
    this.settingStore.on('syncFrequencyChange', this);
    this.settingStore.on('defaultCalendarChange', this);

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

  _renderCalendarLocale: function(value) {
    var selector = 'option[value="' + value + '"]';
    var optionSelected = this.defaultCalendar.querySelector(selector);
    this.defaultCalendarLocale.innerHTML =
      optionSelected.getAttribute('full-name');
  },

  _renderCalendarSelector: function() {
    function genOptGroup(account) {
      var optGroup = document.createElement('optgroup');
      optGroup.setAttribute('account-id', account._id);
      optGroup.label = _('preset-' + account.preset);
      return optGroup;
    }
    function genOption(calendar) {
      var option = document.createElement('option');
      option.value = calendar._id;
      if (calendar._id === Local.calendarId) {
        option.text = navigator.mozL10n.get('calendar-local');
        option.setAttribute('data-l10n-id', 'calendar-local');
      } else {
        option.text = calendar.remote.name;
      }
      return option;
    }
    this.defaultCalendar.innerHTML = '';
    this.allAccounts.forEach(account => {
      this.defaultCalendar.appendChild(genOptGroup(account));
    });
    this.allCalendars.forEach(calendar => {
      var selector = 'optgroup[account-id="' + calendar.accountId + '"]';
      var optgroup = this.defaultCalendar.querySelector(selector);
      if (optgroup) {
        var option = genOption(calendar);
        option.setAttribute('full-name',
          optgroup.label + ' - ' + calendar.remote.name);
        optgroup.appendChild(option);
      }
    });
    this.settingStore.getValue('defaultCalendar', (err, value) => {
      if (err) {
        value = Local.calendarId;
      }
      var defaultExist = this.allCalendars.some(calendar => {
        return calendar._id == value;
      });
      if (!defaultExist) {
        this.settingStore.set('defaultCalendar', Local.calendarId, () => {
          this.defaultCalendar.value = Local.calendarId;
        });
      } else {
        this.defaultCalendar.value = value;
        this._renderCalendarLocale(value);
      }
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
        this.settingStore.set(type, value);
        break;
      case 'defaultCalendar':
        this.settingStore.set(type, value);
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

    this.settingStore.getValue('syncFrequency', renderSyncFrequency);
    this.settingStore.getValue('standardAlarmDefault', renderAlarmDefault('standard'));
    this.settingStore.getValue('alldayAlarmDefault', renderAlarmDefault('allday'));
  }
};

AdvancedSettings.prototype.onfirstseen = AdvancedSettings.prototype.render;

});
