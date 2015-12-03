define(function(require, exports, module) {
'use strict';

var EventBase = require('./event_base');
var DurationTime = require('templates/duration_time');
var Local = require('provider/local');
var alarmTemplate = require('templates/alarm');

require('dom!event-detail-view');

function EventDetail(options) {
  EventBase.apply(this, arguments);
}
module.exports = EventDetail;

EventDetail.prototype = {
  __proto__: EventBase.prototype,

  selectors: {
    element: '#event-detail-view',
    header: '#event-detail-header',
    title: '#event-detail-title',
    location: '#event-detail-location',
    durationTime: '#event-detail-duration-time',
    currentCalendar: '#event-detail-current-calendar',
    alarms: '#event-detail-alarms',
    description: '#event-detail-description'
  },

  get title() {
    return this._findElement('title');
  },

  get location() {
    return this._findElement('location');
  },

  get durationTime() {
    return this._findElement('durationTime');
  },

  get currentCalendar() {
    return this._findElement('currentCalendar');
  },

  get alarms() {
    return this._findElement('alarms');
  },

  get description() {
    return this._findElement('description');
  },

  _initEvents: function() {
    // This method would be called by EventBase.
  },

  /**
   * Updates the UI to use values from the current model.
   */
  _updateUI: function() {
    var model = this.event;
  
    this.title.textContent = model.title;

    this.location.textContent = model.location;

    var dateSrc = model;
    if (model.remote.isRecurring && this.busytime) {
      dateSrc = this.busytime;
    }
    var durationTimeContent =
      DurationTime.durationTimeEventDetail.render(dateSrc);
    this.durationTime.innerHTML = durationTimeContent;

    if (this.originalCalendar) {
      var calendarId = this.originalCalendar.remote.id;
      var isLocalCalendar = calendarId === Local.calendarId;
      var calendarName = isLocalCalendar ?
        navigator.mozL10n.get('calendar-local') :
        this.originalCalendar.remote.name;
        this.currentCalendar.textContent = calendarName;
    } else {
      this.currentCalendar.textContent = '';
    }

    var alarmContent = '';
    var alarms = this.event.alarms;
    if (alarms) {
      alarmContent = alarmTemplate.reminder.render({
        alarms: alarms,
        isAllDay: this.event.isAllDay,
      });
      this.alarms.innerHTML = alarmContent;
    }

    this.description = model.description;
  },

  /**
   * Sets content for an element
   * Hides the element if there's no content to set
   */
  setContent: function(element, content, method) {
    method = method || 'textContent';
    element = this.getEl(element);
    element.querySelector('.content')[method] = content;

    if (!content) {
      element.style.display = 'none';
    } else {
      element.style.display = '';
    }
  },

  oninactive: function() {
    EventBase.prototype.oninactive.apply(this, arguments);
  }
};

});
