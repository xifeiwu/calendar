define(function(require, exports, module) {
'use strict';

var AlarmTemplate = require('templates/alarm');
var EventBase = require('./event_base');
var InputParser = require('shared/input_parser/input_parser');
var Local = require('provider/local');
var QueryString = require('querystring');
var dateFormat = require('date_format');
var getTimeL10nLabel = require('calc').getTimeL10nLabel;
var nextTick = require('next_tick');
var router = require('router');
var debug = require('debug')('modify_event');
var _ = navigator.mozL10n.get;

require('dom!modify-event-view');

function ModifyEvent(options) {
  this.deleteRecord = this.deleteRecord.bind(this);
  this._toggleAllDay = this._toggleAllDay.bind(this);
  EventBase.apply(this, arguments);
  this._keyDownHandler = this._keyDownEvent.bind(this);

  this.calendarList = null;
  this.accountList = null;
}
module.exports = ModifyEvent;

ModifyEvent.prototype = {
  __proto__: EventBase.prototype,

  ERROR_PREFIX: 'event-error-',

  MAX_ALARMS: 1,

  formats: {
    date: 'modify-event-time-format',
    time: 'shortTimeFormat'
  },

  selectors: {
    element: '#modify-event-view',
    alarmList: '#modify-event-view .alarms',
    form: '#modify-event-view form',
    startTimeLocale: '#start-time-locale',
    endDateLocale: '#end-date-locale',
    endTimeLocale: '#end-time-locale',
    status: '#modify-event-view section[role="status"]',
    errors: '#modify-event-view .errors',
    primaryButton: '#modify-event-view .save',
    deleteButton: '#modify-event-view .delete-record',
    header: '#modify-event-header'
  },

  uiSelector: '[name="%"]',

  _duration: 0, // The duration between start and end dates.
  _saveEnable: false,

  _initEvents: function() {
    EventBase.prototype._initEvents.apply(this, arguments);

    this.deleteButton.addEventListener('click', this.deleteRecord);
    this.form.addEventListener('click', this.focusHandler);
    this.form.addEventListener('submit', this.primary);
    var calEvent = this.getEl('calendarId');
    calEvent.addEventListener('change',this.calendarDis.bind(this));
    var allday = this.getEl('allday');
    allday.addEventListener('change', this._toggleAllDay);

    this.alarmList.addEventListener('change', this._changeAlarm.bind(this));

    this.getEl('title').addEventListener('keydown',
      this._checkTitle.bind(this));

    this._setupDateTimeSync('startDate', 'start-date-locale');
    this._setupDateTimeSync('startTime', 'start-time-locale');
    this._setupDateTimeSync('endDate', 'end-date-locale');
    this._setupDateTimeSync('endTime', 'end-time-locale');
  },

  _checkTitle: function() {
    var content = this.getEl('title').value.trim();
    if (content.length) {
      this._saveEnable = true;
    } else {
      this._saveEnable = false;
    }
  },

  /**
   * Fired when the allday checkbox changes.
   */
  _toggleAllDay: function(e) {
    var allday = this.getEl('allday').checked;

    if (allday) {
      // enable case
      this.element.classList.add(this.ALLDAY);
    } else {
      // disable case
      this.element.classList.remove(this.ALLDAY);
    }

    if (e) {
      // only reset the start/end time if coming from an user interaction
      this._resetDateTime();

      // Reset alarms if we come from a user event
      this.event.alarms = [];
      this.updateAlarms(allday);
    }
  },

  _resetDateTime: function() {
    // if start event was "all day" and switch to regular event start/end date
    // will be the same, so we reset to default start time, otherwise we keep
    // the previously selected value
    var allday = this.getEl('allday').checked;
    var startDateTime = this._getStartDateTime();
    var endDateTime = this._getEndDateTime();
    var startDate = new Date(startDateTime);
    var endDate = new Date(endDateTime);

    this._duration = endDateTime - startDateTime;

    if (!allday && startDate.getDate() === endDate.getDate()) {
      this._setDefaultHour(startDate);
      this.getEl('startTime').value = InputParser.exportTime(startDate);
      this._renderDateTimeLocale(
        this._findElement('startTimeLocale'), startDate);
      // default event duration is 1 hour
      this._duration = 60 * 60 * 1000;
      this._setEndDateTimeWithCurrentDuration();
    }
  },

  /**
   * Called when any alarm is changed
   */
  _changeAlarm: function(e) {
    var template = AlarmTemplate;

    // Append a new alarm select only if we don't have an empty one or if we
    // didn't reach the maximum number of alarms
    var alarms = this.queryAlarms();
    if (alarms.length >= this.MAX_ALARMS ||
        alarms.some(el => el.value === 'none')) {
      return;
    }

    var newAlarm = document.createElement('div');
    newAlarm.innerHTML = template.picker.render({
      layout: this.getEl('allday').checked ? 'allday' : 'standard'
    });
    this.alarmList.appendChild(newAlarm);
  },

  /**
   * Check if current event has been stored in the database
   */
  isSaved: function() {
      return !!this.provider;
  },

  /**
   * Build the initial list of calendar ids.
   */
  onfirstseen: function() {
    Promise.all([this._getAccounts(), this._getCalendars()]).then(() => {
      this._updateCalendarIdSelector();
    })
    .catch((err) => {
      return console.error('Error fetching datebase.', err);
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
    this._updateCalendarIdSelector();
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

  _updateCalendarIdSelector: function() {
    var calendarListNode = this.getEl('calendarId');
    calendarListNode.innerHTML = '';
    var key = '';
    var groupNode = null;
    for (key in this.accountList) {
      var name = this.accountList[key].preset;
      groupNode = document.createElement('optgroup');
      groupNode.setAttribute('name', name);
      groupNode.label = _('preset-' + name);
      if (name === 'local') {
        calendarListNode.insertBefore(groupNode, calendarListNode.firstChild);
      } else {
        // XXX: ignore online account for now
        if (!this.app.isOnlineModificationEnable()) {
          continue;
        }
        calendarListNode.appendChild(groupNode);
      }
    }

    var optionNode = null;
    for (key in this.calendarList) {
      var calendar = this.calendarList[key];
      var accountName = this.accountList[calendar.accountId].preset;
      // XXX: ignore online calendar for now
      if (accountName !== 'local' && !this.app.isOnlineModificationEnable()) {
        continue;
      }

      optionNode = document.createElement('option');
      optionNode.value = calendar._id;
      if (calendar._id === Local.calendarId) {
        optionNode.text = navigator.mozL10n.get('calendar-local');
        optionNode.setAttribute('data-l10n-id', 'calendar-local');
      } else {
        optionNode.text = calendar.remote.name;
      }
      calendarListNode.querySelector('optgroup[name="' + accountName + '"]')
        .appendChild(optionNode);
    }
  },

  /**
   * Mark all field's readOnly flag.
   *
   * @param {Boolean} boolean true/false.
   */
  _markReadonly: function(boolean) {
    ['title', 'location', 'startDate', 'startTime', 'endDate', 'endTime',
     'repeat', 'calendarId', 'alarm[]', 'description'].forEach(function(key) {
      this.getEl(key).readOnly = boolean;
    }.bind(this));
  },

  queryAlarms: function() {
    return Array.from(document.querySelectorAll('[name="alarm[]"]'));
  },

  get alarmList() {
    return this._findElement('alarmList');
  },

  get form() {
    return this._findElement('form');
  },

  get deleteButton() {
    return this._findElement('deleteButton');
  },

  get fieldRoot() {
    return this.form;
  },

  /**
   * Ask the provider to persist an event:
   *
   *  1. update the model with form data
   *
   *  2. send it to the provider if it has the capability
   *
   *  3. set the position of the calendar to startDate of new/edited event.
   *
   *  4. redirect to last view.
   *
   * For now both update & create share the same
   * behaviour (redirect) in the future we may change this.
   */
  _persistEvent: function(method, capability) {
    // create model data
    var data = this.formData();
    var errors;

    // we check explicitly for true, because the alternative
    // is an error object.
    if ((errors = this.event.updateAttributes(data)) !== true) {
      this.showErrors(errors);
      return;
    }

    // can't create without a calendar id
    // because of defaults this should be impossible.
    if (!data.calendarId) {
      return;
    }

    var self = this;
    var provider;
    var calendar;

    this.store.providerFor(this.event, fetchProvider);

    function fetchProvider(err, result, owners) {
      provider = result;
      calendar = owners.calendar;
      provider.eventCapabilities(
        self.event.data,
        verifyCaps
      );
    }

    function verifyCaps(err, caps) {
      if (err) {
        return console.error('Error fetching capabilities for', self.event);
      }

      // safe-guard but should not ever happen.
      if (caps[capability]) {
        persistEvent();
      }
    }

    function persistEvent() {
      var list = self.element.classList;

      // mark view as 'in progress' so we can style
      // it via css during that time period
      list.add(self.PROGRESS);

      var moveDate = self.event.startDate;
      self.event.remote.color = calendar.remote.color;

      var callback = function(err, busytimeOrId) {
        list.remove(self.PROGRESS);

        if (err) {
          self.showErrors(err);
          return;
        }

        // move the position in the calendar to the added/edited day
        self.app.timeController.move(moveDate);
        // order is important the above method triggers the building
        // of the dom elements so selectedDay must come after.
        self.app.timeController.selectedDay = moveDate;

        // we pass the date so we are able to scroll to the event on the
        // day/week views
        var state = {
          eventStartHour: moveDate.getHours()
        };

        // To 'sync' local account if it's a recurring event just added
        if (self.event.remote.isRecurring) {
          nextTick(function() {
            self.store.ownersOf(self.event, function(err, owners) {
              if (err) {
                return console.error('Fetch owners error: ' + err);
              }

              if (owners.account.providerType === 'Local') {
                self.app.recurringEventsController.queueExpand(
                  self.app.timeController.position
                );
              }
            });
          });
        }

        if (method === 'updateEvent' ||
            method === 'updateEventAll' ||
            method === 'updateEventThisOnly') {
          // As updateEvent will change busytime id, if the previous page
          // is eventDetail. window.history.back() will go to a path that
          // not exist. if the previous page is eventDetail, we will need
          // to refresh the location of previous using new busytime id.
          var pathToGo = self.returnTo();
          if (/^\/event\/detail\//.test(pathToGo) &&
              typeof(busytimeOrId) === 'object') {
            pathToGo = '/event/detail/' + busytimeOrId._id;
          } else if (!busytimeOrId) {
            pathToGo = '/event/list/';
          }
          router.go(pathToGo);

          return;
        }

        self.app.toast.show({message: _('toast-event-add-success')});
        router.go(self.returnTo(), state);
      };

      if (method === 'createEvent') {
        provider[method](self.event.data, callback);
      } else {
        provider[method](self.event.data, self.busytimeId, callback);
      }
    }
  },

  /**
   * Deletes current record if provider is present and has the capability.
   */
  deleteRecord: function(event) {
    if (event) {
      event.preventDefault();
    }

    if (this.isSaved()) {
      var self = this;
      var handleDelete = function me_handleDelete() {
        self.provider.deleteEvent(self.event.data, function(err) {
          if (err) {
            self.showErrors(err);
            return;
          }

          // If we edit a view our history stack looks like:
          //   /week -> /event/view -> /event/save -> /event/view
          // We need to return all the way to the top of the stack
          // We can remove this once we have a history stack
          self.app.view('ViewEvent', function(view) {
            router.go(view.returnTop());
          });
        });
      };

      this.provider.eventCapabilities(this.event.data, function(err, caps) {
        if (err) {
          return console.error('Error fetching event capabilities', this.event);
        }

        if (caps.canDelete) {
          handleDelete();
        }
      });
    }
  },

  /**
   * Persist current model.
   */
  primary: function(event) {
    if (event) {
      event.preventDefault();
    }

    // Disable the button on primary event to avoid race conditions
    this.disablePrimary();

    if (this.isSaved()) {
      if (this.editType === 'edit-all') {
        this._persistEvent('updateEventAll', 'canUpdate');
      } else if (this.editType === 'edit-this-only') {
        this._persistEvent('updateEventThisOnly', 'canUpdate');
      } else {
        this._persistEvent('updateEvent', 'canUpdate');
      }
    } else {
      this._persistEvent('createEvent', 'canCreate');
    }
  },

  /**
   * Enlarges focus areas for .button controls
   */
  focusHandler: function(e) {
    var input = e.target.querySelector('input, select');
    if (input && e.target.classList.contains('button')) {
      input.focus();
    }
  },

  /**
   * Export form information into a format
   * the model can understand.
   *
   * @return {Object} formatted data suitable
   *                  for use with Calendar.Model.Event.
   */
  formData: function() {
    var fields = {
      title: this.getEl('title').value,
      location: this.getEl('location').value,
      repeat: this.getEl('repeat').value,
      calendarId: this.getEl('calendarId').value,
      description: this.getEl('description').innerHTML,
      isAllDay: this.getEl('allday').checked,
      recurrenceId: ''
    };

    if (!this.isSaved()) {
      fields.timeStamp = new Date().getTime();
    } else {
      fields.timeStamp = this.event.timeStamp;
    }

    if (fields.repeat !== 'never') {
      fields.isRecurring = true;
    } else {
      fields.isRecurring = false;
    }

    var startTime;
    var endTime;
    var allday = this.getEl('allday').checked;

    if (allday) {
      startTime = null;
      endTime = null;
    } else {
      startTime = this.getEl('startTime').value;
      endTime = this.getEl('endTime').value;
    }

    fields.startDate = InputParser.formatInputDate(
      this.getEl('startDate').value,
      startTime
    );

    fields.endDate = InputParser.formatInputDate(
      this.getEl('endDate').value,
      endTime
    );

    if (allday) {
      // when the event is all day we display the same
      // day that the entire event spans but we must actually
      // end the event at the first second, minute hour of the next
      // day. This will ensure the server handles it as an all day event.
      fields.endDate.setDate(
        fields.endDate.getDate() + 1
      );
    }

    fields.alarms = [];
    var triggers = ['none'];
    this.queryAlarms().forEach(alarm => {
      if (triggers.indexOf(alarm.value) !== -1) {
        return;
      }

      triggers.push(alarm.value);

      fields.alarms.push({
        action: 'DISPLAY',
        trigger: parseInt(alarm.value, 10)
      });
    });

    return fields;
  },

  enablePrimary: function() {
    this.primaryButton.removeAttribute('aria-disabled');
  },

  disablePrimary: function() {
    this.primaryButton.setAttribute('aria-disabled', 'true');
    this._saveEnable = false;
  },

  /**
   * Re-enable the primary button when we show errors
   */
  showErrors: function() {
    this.enablePrimary();
    EventBase.prototype.showErrors.apply(this, arguments);
  },

  /**
   * Read the urlparams and override stuff on our event model.
   * @param {string} search Optional string of the form ?foo=bar&cat=dog.
   * @private
   */
  _overrideEvent: function(search) {
    search = search || window.location.search;
    if (!search || search.length === 0) {
      return;
    }

    // Remove the question mark that begins the search.
    if (search.substr(0, 1) === '?') {
      search = search.substr(1, search.length - 1);
    }

    var field, value;
    // Parse the urlparams.
    var params = QueryString.parse(search);
    for (field in params) {
      value = params[field];
      switch (field) {
        case ModifyEvent.OverrideableField.START_DATE:
        case ModifyEvent.OverrideableField.END_DATE:
          params[field] = new Date(value);
          break;
        default:
          params[field] = value;
          break;
      }
    }

    // Override fields on our event.
    var model = this.event;
    for (field in ModifyEvent.OverrideableField) {
      value = ModifyEvent.OverrideableField[field];
      model[value] = params[value] || model[value];
    }
  },

  /**
   * Updates form to use values from the current model.
   *
   * Does not handle readonly flags or calenarId associations.
   * Suitable for use in pre-populating values for both new and
   * existing events.
   *
   * Resets any value on the current form.
   */
  _updateUI: function() {
    this._overrideEvent();
    this.form.reset();

    var model = this.event;
    this.getEl('title').value = model.title;
    this.getEl('location').value = model.location;
    var dateSrc = model;
    if (model.remote.isRecurring && this.busytime &&
        this.editType === 'edit-this-only') {
      dateSrc = this.busytime;
    }

    var startDate = dateSrc.startDate;
    var endDate = dateSrc.endDate;
    this._duration = endDate.getTime() - startDate.getTime();

    // update the allday status of the view
    var allday = this.getEl('allday');
    if (allday && (allday.checked = model.isAllDay)) {
      this._toggleAllDay();
      endDate = this.formatEndDate(endDate);
    }

    this.getEl('startDate').value = InputParser.exportDate(startDate);
    var startDateLocale = document.getElementById('start-date-locale');
    this._renderDateTimeLocale(startDateLocale, startDate);

    this.getEl('endDate').value = InputParser.exportDate(endDate);
    var endDateLocale = document.getElementById('end-date-locale');
    this._renderDateTimeLocale(endDateLocale, endDate);

    this.getEl('startTime').value = InputParser.exportTime(startDate);
    var startTimeLocale = document.getElementById('start-time-locale');
    this._renderDateTimeLocale(startTimeLocale, startDate);

    this.getEl('endTime').value = InputParser.exportTime(endDate);
    var endTimeLocale = document.getElementById('end-time-locale');
    this._renderDateTimeLocale(endTimeLocale, endDate);

    if (this.editType === 'edit-this-only') {
      this.getEl('repeat').value = 'never';
    } else {
      this.getEl('repeat').value = model.repeat;
    }

    this.getEl('description').innerHTML = model.description;

    // update calendar id
    this.getEl('calendarId').value = model.calendarId;
    this.calendarDis();

    // calendar display
    var currentCalendar = this.getEl('currentCalendar');

    if (this.originalCalendar) {
      currentCalendar.value =
        this.originalCalendar.remote.name;

      currentCalendar.readOnly = true;
    }

    this.updateAlarms(model.isAllDay);
  },

  calendarDis: function () {
    var _calId = this.getEl('calendarId').value;
    var calStore = this.app.store('Calendar');
    var self = this;
    calStore.ownersOf(_calId, function (err, owners) {
      if (err) {
        return console.error(err);
      }
      var disSpan = self.element.querySelector('#calendarIdSpan');
      disSpan.textContent = _('account-calendar-format', {
        account: _('preset-' + owners.account.preset),
        calendar: owners.calendar.remote.name
      });
    });
  },

  /**
   * Handling a layer over <input> to have localized
   * date/time
   */
  _setupDateTimeSync: function(src, target, value) {
    var srcElement = this.getEl(src);
    var targetElement = document.getElementById(target);
    if (!targetElement) {
      return;
    }

    var type = targetElement.dataset.type;
    var callback = type === 'date' ?
      this._updateDateLocaleOnInput : this._updateTimeLocaleOnInput;

    srcElement.addEventListener('input', function(e) {
      callback.call(this, targetElement, e);

      // We only auto change the end date and end time
      // when user changes start date or start time,
      // or end datetime is NOT after start datetime
      // after changing end date or end time.
      // Otherwise, we don't auto change end date and end time.
      if (targetElement.id === 'start-date-locale' ||
          targetElement.id === 'start-time-locale') {
        this._setEndDateTimeWithCurrentDuration();
      } else if (this._getEndDateTime() <= this._getStartDateTime()) {
        this._setEndDateTimeWithCurrentDuration();
        this.showErrors({
          name: type === 'date' ?
            'start-date-after-end-date' :
            'start-time-after-end-time'
        });
      }
      this._duration = this._getEndDateTime() - this._getStartDateTime();
    }.bind(this));


    srcElement.addEventListener('blur', function(e) {
      var date = targetElement.dataset.date;
      if (type === 'date') {
        this.value = new Date(date).toLocaleFormat('%Y-%m-%d');
      } else if (type === 'time') {
        this.value = new Date(date).toLocaleFormat('%H:%M:%S');
      }
    });
  },

  _setEndDateTimeWithCurrentDuration: function() {
    var allday = this.getEl('allday').checked;
    var date = new Date(this._getStartDateTime() + this._duration);
    if (allday){
      date.setDate(date.getDate() - 1);
      var endDateLocale = this._findElement('endDateLocale');
      this.getEl('endDate').value = InputParser.exportDate(date);
      this._renderDateTimeLocale(endDateLocale, date);
    } else {
      var endDateLocale = this._findElement('endDateLocale');
      var endTimeLocale = this._findElement('endTimeLocale');
      this.getEl('endDate').value = InputParser.exportDate(date);
      this.getEl('endTime').value = InputParser.exportTime(date);
      this._renderDateTimeLocale(endDateLocale, date);
      this._renderDateTimeLocale(endTimeLocale, date);
    }

  },

  _getStartDateTime: function() {
    var allday = this.getEl('allday').checked;
    var date = null;
    if (allday) {
      date = InputParser.formatInputDate(
        this.getEl('startDate').value, null);
    } else {
      date = InputParser.formatInputDate(
        this.getEl('startDate').value, this.getEl('startTime').value);
    }
    return date.getTime();
  },

  _getEndDateTime: function() {
    var allday = this.getEl('allday').checked;
    var date = null;
    if (allday) {
      date = InputParser.formatInputDate(
        this.getEl('endDate').value, null);
      date.setDate(date.getDate() + 1);
    } else {
      date = InputParser.formatInputDate(
        this.getEl('endDate').value, this.getEl('endTime').value);
    }
    return date.getTime();
  },

  _renderDateTimeLocale: function(targetElement, value) {
    // we inject the targetElement to make it easier to test
    var type = targetElement.dataset.type;
    var localeFormat = dateFormat.localeFormat;
    var formatKey = this.formats[type];
    if (type === 'time') {
      formatKey = getTimeL10nLabel(formatKey);
    }
    var format = navigator.mozL10n.get(formatKey);
    targetElement.textContent = localeFormat(value, format);
    // we need to store the format and date for l10n
    targetElement.setAttribute('data-l10n-date-format', formatKey);
    targetElement.dataset.date = value;
  },

  _updateDateLocaleOnInput: function(targetElement, e) {
    var selected = InputParser.importDate(e.target.value);
    // use date constructor to avoid issues, see Bug 966516
    var date = new Date(selected.year, selected.month, selected.date);
    this._renderDateTimeLocale(targetElement, date);
  },

  _updateTimeLocaleOnInput: function(targetElement, e) {
    var selected = InputParser.importTime(e.target.value);
    var date = new Date();
    date.setHours(selected.hours);
    date.setMinutes(selected.minutes);
    date.setSeconds(0);
    this._renderDateTimeLocale(targetElement, date);
  },

  /**
   * Called on render or when toggling an all-day event
   */
  updateAlarms: function(isAllDay, callback) {
    var template = AlarmTemplate;
    var alarms = [];

    // Used to make sure we don't duplicate alarms
    var alarmMap = {};

    if (this.event.alarms) {
      //jshint boss:true
      for (var i = 0, alarm; alarm = this.event.alarms[i]; i++) {
        alarmMap[alarm.trigger] = true;
        alarm.layout = isAllDay ? 'allday' : 'standard';
        alarms.push(alarm);
      }
    }

    var settings = this.app.store('Setting');
    var layout = isAllDay ? 'allday' : 'standard';
    settings.getValue(layout + 'AlarmDefault', next.bind(this));

    function next(err, value) {
      //jshint -W040
      if (!this.isSaved() && !alarmMap[value] && !this.event.alarms.length) {
        alarms.push({
          layout: layout,
          trigger: value
        });
      }

      if ((alarms.length === 0 && this.isSaved())) {
        alarms.push({
          layout: layout,
          trigger: value
        });
      }

      this.alarmList.innerHTML = template.picker.renderEach(alarms).join('');

      if (callback) {
        callback();
      }
    }
  },

  reset: function() {
    var list = this.element.classList;

    list.remove(this.UPDATE);
    list.remove(this.CREATE);
    list.remove(this.READONLY);
    list.remove(this.ALLDAY);

    this._returnTo = null;
    this._markReadonly(false);
    this.provider = null;
    this.event = null;
    this.busytime = null;

    this.alarmList.innerHTML = '';

    this.form.reset();
  },

  _keyDownEvent: function(evt) {
    switch(evt.key) {
      case 'AcaSoftLeft':
        this.cancel();
        evt.preventDefault();
        break;
      case 'Enter':
        debug('Enter.');
        break;
      case 'AcaSoftRight':
        if (this._saveEnable) {
          this.primary();
        }
        break;
    }
  },

  onactive: function() {
    EventBase.prototype.onactive.apply(this, arguments);
    this.element.addEventListener('keydown', this._keyDownHandler);
  },

  ondispatch: function() {
    var firstEle = this.element.querySelector('form ul .title');
    this.element.focus();
    this.element.spatialNavigator.focus(firstEle);
    this._checkTitle();
  },

  oninactive: function() {
    EventBase.prototype.oninactive.apply(this, arguments);
    this.element.removeEventListener('keydown', this._keyDownHandler);
    this.reset();
  }
};

/**
 * The fields on our event model which urlparams may override.
 * @enum {string}
 */
ModifyEvent.OverrideableField = {
  CALENDAR_ID: 'calendarId',
  DESCRIPTION: 'description',
  END_DATE: 'endDate',
  IS_ALL_DAY: 'isAllDay',
  LOCATION: 'location',
  START_DATE: 'startDate',
  TITLE: 'title'
};

});
