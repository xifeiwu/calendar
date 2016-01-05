define(function(require, exports, module) {
'use strict';

var Calc = require('calc');
var DateSpan = require('templates/date_span');
var create = require('template').create;
var dateFormat = require('date_format');

var l10n = navigator.mozL10n;

module.exports = create({
  durationTime: function() {
    var format = '';
    var startDate = this.arg('startDate');
    var endDate = this.arg('endDate');
    var isAllDay = this.arg('isAllDay');

    if (isAllDay) {
      // Use the last second of previous day as the base for endDate
      // (e.g., 1991-09-14T23:59:59 insteads of 1991-09-15T00:00:00).
      endDate = new Date(endDate - 1000);
      format = Calc.isSameDate(startDate, endDate) ?
        'one-all-day-duration' :
        'multiple-all-day-duration';
    } else {
      format = Calc.isSameDate(startDate, endDate) ?
        'one-day-duration' :
        'multiple-day-duration';
    }

    return l10n.get(format, {
      startTime: formatTime(startDate),
      startDate: formatDate(startDate),
      endTime: formatTime(endDate),
      endDate: formatDate(endDate)
    });
  },

  durationTimeEventDetail: function() {
    var format = '';
    var startDate = this.arg('startDate');
    var endDate = this.arg('endDate');
    var isAllDay = this.arg('isAllDay');
    var isRecurring = this.arg('isRecurring');
    var repeat = this.arg('repeat');
    var selectedDate = this.arg('selectedDate');

    if (isRecurring) {
      // convert startDate and endDate to current selected Date
      startDate.setFullYear(selectedDate.getFullYear());
      startDate.setMonth(selectedDate.getMonth());
      startDate.setDate(selectedDate.getDate());
      endDate.setFullYear(selectedDate.getFullYear());
      endDate.setMonth(selectedDate.getMonth());
      endDate.setDate(selectedDate.getDate());
    }

    if (isAllDay) {
      // Use the last second of previous day as the base for endDate
      // (e.g., 1991-09-14T23:59:59 insteads of 1991-09-15T00:00:00).
      endDate = new Date(endDate - 1000);
      format = Calc.isSameDate(startDate, endDate) ?
        'one-all-day-duration-event-detail' :
        'multiple-all-day-duration-event-detail';
    } else {
      format = Calc.isSameDate(startDate, endDate) ?
        'one-day-duration-event-detail-to' :
        'multiple-day-duration-event-detail';
    }

    var content = l10n.get(format, {
      startTime: formatTimeEventDetail(startDate),
      startDate: formatDateEventDetail(startDate),
      endTime: formatTimeEventDetail(endDate),
      endDate: formatDateEventDetail(endDate)
    });

    if (isRecurring) {
      content += l10n.get('event-detail-repeat', {
        repeat: repeat ? l10n.get(repeat) : l10n.get('repeating-event')
      });
    }

    return content;
  }
});

function formatDate(date) {
  return dateFormat.localeFormat(
    date,
    l10n.get('longDateFormat')
  );
}

function formatTime(time) {
  return DateSpan.time.render({
    time: time,
    format: 'shortTimeFormat'
  });
}

function formatDateEventDetail(date) {
  return dateFormat.localeFormat(
    date,
    l10n.get('events-detail-duration-format')
  );
}

function formatTimeEventDetail(time) {
  return DateSpan.time.render({
    time: time,
    format: 'shortTimeFormat'
  });
}

});
