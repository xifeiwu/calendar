define(function(require, exports, module) {
'use strict';

var AlarmTemplate = require('templates/alarm');
var View = require('view');
var router = require('router');
var Local = require('provider/local');
var nextTick = require('next_tick');
var debug = require('debug')('advanced_settings');
var _ = navigator.mozL10n.get;

require('dom!advanced-settings-view');

function AdvancedSettings(options) {
  View.apply(this, arguments);
  this._initEvents();
  this.initHeader();
}
module.exports = AdvancedSettings;

AdvancedSettings.prototype = {
  __proto__: View.prototype,

  selectors: {
    element: '#advanced-settings-view',
    setupCalendar: '#advanced-settings-view .sk-advs-setup-calendar',
    syncFrequency: '#setting-sync-frequency',
    header: '#advanced-settings-header',
    standardAlarmLabel: '#default-event-alarm',
    alldayAlarmLabel: '#default-allday-alarm',
    defaultCalendar: '#advanced-settings-view select[name="defaultCalendar"]',
    defaultCalendarLocale: '#advanced-settings-view ' +
      'span[name="defaultCalendar-locale"]'
  },

  get rootElement() {
    return this._findElement('element');
  },

  get setupCalendar() {
    return this._findElement('setupCalendar');
  },

  get syncFrequency() {
    return this._findElement('syncFrequency');
  },

  get standardAlarmLabel() {
    return this._findElement('standardAlarmLabel');
  },

  get alldayAlarmLabel() {
    return this._findElement('alldayAlarmLabel');
  },

  get header() {
    return this._findElement('header');
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

    this.syncFrequency.addEventListener('change', this);

    this.standardAlarmLabel.addEventListener('change', this);
    this.alldayAlarmLabel.addEventListener('change', this);
    this.defaultCalendar.addEventListener('change', this);

    this.accountStore = this.app.store('Account');
    this.calendarStore = this.app.store('Calendar');

    this.renderCalendarSelector =
      this._renderCalendarSelector.bind(this);
    this.accountStore.on('add', this.renderCalendarSelector);
    this.accountStore.on('remove', this.renderCalendarSelector);
    this.calendarStore.on('add', this.renderCalendarSelector);
    this.calendarStore.on('remove', this.renderCalendarSelector);
    this.calendarStore.on('update', this.renderCalendarSelector);
  },

  _renderCalendarSelector: function() {
    this.defaultCalendar.innerHTML = '';
    var key = '';
    var groupNode = null;
    var name = '';
    for (key in this.accountStore._cached) {
      name = this.accountStore._cached[key].preset;
      groupNode = document.createElement('optgroup');
      groupNode.setAttribute('name', name);
      groupNode.label = _('preset-' + name);
      if (name === 'local') {
        this.defaultCalendar.insertBefore(groupNode,
          this.defaultCalendar.firstChild);
      } else {
        this.defaultCalendar.appendChild(groupNode);
      }
    }

    var accountName = '';
    var accountSelector = '';
    var accountNode = null;
    var optionNode = null;
    var calendar = null;
    for (key in this.calendarStore._cached) {
      calendar = this.calendarStore._cached[key];
      accountName = this.accountStore._cached[calendar.accountId].preset;
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
  },

  handleSettingDbChange: function(type, value) {
    switch (type) {
      case 'syncFrequencyChange':
        this.syncFrequency.value = String(value);
        break;
      case 'defaultCalendarChange':
        this.renderDefaultCalendar(null, value);
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
    SoftkeyHandler.register(this.setupCalendar, {
      dpe: {
        name: 'select',
        action: () => {
          router.go('/setup-calendar/');
        }
      }
    });
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    this._keyDownHandler = this.handleKeyDownEvent.bind(this);
    window.addEventListener('keydown', this._keyDownHandler, false);
    this.rootElement.focus();
  },

  oninactive: function() {
    View.prototype.oninactive.call(this);
    window.removeEventListener('keydown', this._keyDownHandler);
  },

  renderDefaultCalendar: function(err, value) {
    if (err) {
      return;
    }
    var selector = 'option[value="' + value + '"]';
    var optionSelected = this.defaultCalendar.querySelector(selector);
    if (optionSelected) {
      this.defaultCalendarLocale.innerHTML =
        optionSelected.getAttribute('full-name');
    } else {
      this.defaultCalendarLocale
        .setAttribute('data-l10n-id', 'choose-default-calendar');
    }
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
    settings.getValue('defaultCalendar', this.renderDefaultCalendar.bind(this));

    this._renderCalendarSelector();
  }
};

AdvancedSettings.prototype.onfirstseen = AdvancedSettings.prototype.render;

});
