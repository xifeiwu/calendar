define(function(require, exports, module) {
'use strict';

var AlarmTemplate = require('templates/alarm');
var View = require('view');
var router = require('router');
var Local = require('provider/local');
var nextTick = require('next_tick');
var debug = require('debug')('advanced_settings');

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
    defaultCalendar: '#advanced-settings-view select[name="defaultCalendar"]'
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
    this.syncFrequency.addEventListener('change', this);

    this.standardAlarmLabel.addEventListener('change', this);
    this.alldayAlarmLabel.addEventListener('change', this);

    var calendars = this.app.store('Calendar');
    calendars.on('add', this._addCalendarId.bind(this));
    calendars.on('preRemove', this._removeCalendarId.bind(this));
    calendars.on('remove', this._removeCalendarId.bind(this));
    calendars.on('update', this._updateCalendarId.bind(this));
  },

  handleSettingDbChange: function(type, value) {
    switch (type) {
      case 'syncFrequencyChange':
        this.syncFrequency.value = String(value);
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
    }
  },

  handleEvent: function(event) {
    switch (event.type) {
      case 'change':
        var target = event.target;
        this.handleSettingUiChange(target.name, target.value);
        break;
      case 'syncFrequencyChange':
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

    this._initCalendarList();
  },

  _initCalendarList: function() {
    var calendarStore = this.app.store('Calendar');
    calendarStore.all((err, calendars) => {
      if (err) {
        return console.error('Could not build list of calendars');
      }

      var pending = 0;
      var self = this;

      function next() {
        if (!--pending) {
          if (self.onafteronfirstseen) {
            self.onafteronfirstseen();
          }
        }
      }

      for (var id in calendars) {
        pending++;
        this._addCalendarId(id, calendars[id], next);
      }

    });
  },

  /**
   * Updates a calendar id option.
   *
   * @param {String} id calendar id.
   * @param {Calendar.Model.Calendar} calendar model.
   */
  _updateCalendarId: function(id, calendar) {
    var option = this.defaultCalendar.querySelector('[value="' + id + '"]');

    var store = this.app.store('Calendar');

    store.providerFor(calendar, (err, provider) => {
      var caps = provider.calendarCapabilities(
        calendar
      );

      if (!caps.canCreateEvent) {
        this._removeCalendarId(id);
        return;
      }

      if (option) {
        option.text = calendar.remote.name;
      }


      if (this.oncalendarupdate) {
        this.oncalendarupdate(calendar);
      }
    });
  },

  /**
   * Add a single calendar id.
   *
   * @param {String} id calendar id.
   * @param {Calendar.Model.Calendar} calendar calendar to add.
   * @param {callback} callback of _addCalendarId.
   */
  _addCalendarId: function(id, calendar, callback) {
    var store = this.app.store('Calendar');
    store.providerFor(calendar, (err, provider) => {
      var caps = provider.calendarCapabilities(
        calendar
      );

      if (!caps.canCreateEvent) {
        if (callback) {
          nextTick(callback);
        }
        return;
      }

      var option;

      option = document.createElement('option');

      if (id === Local.calendarId) {
        option.text = navigator.mozL10n.get('calendar-local');
        option.setAttribute('data-l10n-id', 'calendar-local');
      } else {
        option.text = calendar.remote.name;
      }

      option.value = id;
      this.defaultCalendar.add(option);

      if (callback) {
        nextTick(callback);
      }

      if (this.onaddcalendar) {
        this.onaddcalendar(calendar);
      }
    });
  },

  /**
   * Remove a single calendar id.
   *
   * @param {String} id to remove.
   */
  _removeCalendarId: function(id) {
    var option = this.defaultCalendar.querySelector('[value="' + id + '"]');
    if (option) {
      this.defaultCalendar.removeChild(option);
    }

    if (this.onremovecalendar) {
      this.onremovecalendar(id);
    }
  },

};

AdvancedSettings.prototype.onfirstseen = AdvancedSettings.prototype.render;

});
