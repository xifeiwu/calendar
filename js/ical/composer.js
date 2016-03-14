/* global jstz */
define(function(require, exports, module) {
'use strict';

var ICAL = require('ext/ical');
var Calc = require('calc');
var uuid = require('ext/uuid');

var DAY_INDEX = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

var _calTimeOffset = function() {
  var d = new Date();
  var offset = d.getTimezoneOffset();
  var from = '00' + (Math.abs(offset) / 60) + '00';
  from = from.slice(-4);

  if (offset <= 0) {
    from = '+' + from;
  } else {
    from = '-' + from;
  }

  return from;
};

var _calDateOffset = function(startDate, endDate) {
  // clone date
  var _startDate = new Date(startDate);
  var _endDate = new Date(endDate);
  // clear time info
  _startDate.setHours(0);
  _startDate.setMinutes(0);
  _startDate.setSeconds(0);
  _startDate.setMilliseconds(0);
  _endDate.setHours(0);
  _endDate.setMinutes(0);
  _endDate.setSeconds(0);
  _endDate.setMilliseconds(0);
  return _endDate - _startDate;
};

var _copyDate = function(srcDate, dstDate) {
  dstDate.setDate(srcDate.getDate());
  dstDate.setMonth(srcDate.getMonth());
  dstDate.setFullYear(srcDate.getFullYear());
};

var _calRrule = function(event) {
  var rule = '';
  switch (event.remote.repeat) {
    case 'every-day':
      rule = 'FREQ=DAILY';
      break;
    case 'every-week':
      rule = 'FREQ=WEEKLY;BYDAY=' +
        DAY_INDEX[new Date(event.remote.startDate).getDay()];
      break;
    case 'every-2-weeks':
      rule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=' +
        DAY_INDEX[new Date(event.remote.startDate).getDay()];
      break;
    case 'every-month':
      rule = 'FREQ=MONTHLY;BYMONTHDAY=' +
        new Date(event.remote.startDate).getDate();
      break;
    case 'every-year':
      // XXX: Since ical.js cannot handle 2.29 in leap year with YEARLY,
      // so useing 12*month here instead of YEARLY as a workaround.
      rule = 'FREQ=MONTHLY;INTERVAL=12;BYMONTHDAY=' +
        new Date(event.remote.startDate).getDate();
      break;
  }
  return rule;
};

exports.calendar = function(event) {
  var ical = '';
  ical += 'BEGIN:VCALENDAR\r\n';
  ical += 'PRODID:-//H5OS//Calendar 1.0//EN\r\n';
  ical += 'VERSION:2.0\r\n';

  // timezone
  ical += exports.timezone(event);

  // event
  ical += exports.event(event);

  ical += 'END:VCALENDAR\r\n';
  return ical;
};

exports.event = function(event) {
  var tzid = jstz.determine().name();
  var dtstart = new Date(event.remote.startDate);
  var dtend = new Date(event.remote.endDate);
  var isAllDay = Calc.isAllDay(dtstart, dtstart, dtend);
  var dtstamp = new Date().toString('yyyyMMddTHHmmss');

  var eventComp = '';
  eventComp += 'BEGIN:VEVENT\r\n';
  if (isAllDay) {
    eventComp += 'DTSTART;VALUE=DATE:' + dtstart.toString('yyyyMMdd') + '\r\n';
    eventComp += 'DTEND;VALUE=DATE:' + dtend.toString('yyyyMMdd') + '\r\n';
    eventComp += 'TRANSP:TRANSPARENT\r\n';
  } else {
    eventComp += 'DTSTART;TZID=' + tzid + ':' +
      dtstart.toString('yyyyMMddTHHmmss') + '\r\n';
    eventComp += 'DTEND;TZID=' + tzid + ':' +
      dtend.toString('yyyyMMddTHHmmss') + '\r\n';
    eventComp += 'TRANSP:OPAQUE\r\n';
  }
  if (event.remote.repeat !== 'never') {
    eventComp += 'RRULE:' + _calRrule(event) + '\r\n';
  }
  eventComp += 'DTSTAMP;TZID=' + tzid + ':' + dtstamp + '\r\n';
  eventComp += 'UID:' + uuid() + '\r\n';
  eventComp += 'DESCRIPTION:' + event.remote.description + '\r\n';
  eventComp += 'LOCATION:' + event.remote.location + '\r\n';
  eventComp += 'SEQUENCE:0\r\n';
  eventComp += 'STATUS:CONFIRMED\r\n';
  eventComp += 'SUMMARY:' + event.remote.title + '\r\n';

  event.remote.alarms.forEach(function(alarm) {
    eventComp += exports.alarm(alarm);
  });

  eventComp += 'END:VEVENT\r\n';
  return eventComp;
};

exports.exceptionEvent = function(event, parentModel) {
  var tzid = jstz.determine().name();

  var dtstart = new Date(event.remote.startDate);
  var dtend = new Date(event.remote.endDate);

  var isAllDay = Calc.isAllDay(dtstart, dtstart, dtend);
  var dtstamp = new Date().toString('yyyyMMddTHHmmss');

  var eventComp = '';
  eventComp += 'BEGIN:VEVENT\r\n';
  if (isAllDay) {
    eventComp += 'DTSTART;VALUE=DATE:' + dtstart.toString('yyyyMMdd') + '\r\n';
    eventComp += 'DTEND;VALUE=DATE:' + dtend.toString('yyyyMMdd') + '\r\n';
  } else {
    eventComp += 'DTSTART;TZID=' + tzid + ':' +
      dtstart.toString('yyyyMMddTHHmmss') + '\r\n';
    eventComp += 'DTEND;TZID=' + tzid + ':' +
      dtend.toString('yyyyMMddTHHmmss') + '\r\n';
  }
  // The format of RECURRENCE-ID in exception event depends on
  // whether the recurring event is all-day or not.
  if (parentModel.isAllDay) {
    eventComp += 'RECURRENCE-ID;VALUE=DATE:' +
      parentModel.startDate.toString('yyyyMMdd') + '\r\n';
    eventComp += 'TRANSP:TRANSPARENT\r\n';
  } else {
    eventComp += 'RECURRENCE-ID;TZID=' + tzid + ':' +
      parentModel.startDate.toString('yyyyMMddTHHmmss') + '\r\n';
    eventComp += 'TRANSP:OPAQUE\r\n';
  }

  eventComp += 'DTSTAMP;TZID=' + tzid + ':' + dtstamp + '\r\n';
  eventComp += 'UID:' + event.remote.id + '\r\n';
  eventComp += 'DESCRIPTION:' + event.remote.description + '\r\n';
  eventComp += 'LOCATION:' + event.remote.location + '\r\n';
  eventComp += 'SEQUENCE:0\r\n';
  eventComp += 'STATUS:CONFIRMED\r\n';
  eventComp += 'SUMMARY:' + event.remote.title + '\r\n';

  event.remote.alarms.forEach(function(alarm) {
    eventComp += exports.alarm(alarm);
  });

  eventComp += 'END:VEVENT\r\n';
  return eventComp;
};

/**
 * generate timezone component and return string
 */
exports.timezone = function(event) {
  var tzid = jstz.determine().name();
  var dtstart = new Date(event.remote.startDate).toString('yyyyMMddTHHmmss');
  var offset = _calTimeOffset();

  var tzComp = '';
  tzComp += 'BEGIN:VTIMEZONE\r\n';
  tzComp += 'TZID:' + tzid + '\r\n';
  tzComp += 'BEGIN:STANDARD\r\n';
  tzComp += 'TZOFFSETFROM:' + offset + '\r\n';
  tzComp += 'TZOFFSETTO:' + offset + '\r\n';
  tzComp += 'DTSTART:19700101T000000\r\n';
  tzComp += 'END:STANDARD\r\n';
  tzComp += 'END:VTIMEZONE\r\n';
  return tzComp;
};

/**
 * generate alarm component in string
 */
exports.alarm = function(alarm) {
  var alarmComp = '';
  alarmComp += 'BEGIN:VALARM\r\n';
  if (alarm.trigger < 0) {
    alarmComp += 'TRIGGER:-PT' + (Math.abs(alarm.trigger) / 60) + 'M\r\n';
  } else {
    alarmComp += 'TRIGGER:PT' + (Math.abs(alarm.trigger) / 60) + 'M\r\n';
  }
  alarmComp += 'ACTION:' + alarm.action + '\r\n';
  alarmComp += 'END:VALARM\r\n';
  return alarmComp;
};

/**
 * generate an exdate from an event
 */
exports.exdate = function(event, date) {
  var dtstart = new Date(event.remote.startDate);
  var dtend = new Date(event.remote.endDate);
  var isAllDay = Calc.isAllDay(dtstart, dtstart, dtend);

  var prop = new ICAL.Property('EXDATE');
  if (isAllDay) {
    prop.setParameter('VALUE', 'DATE');
    prop.setValue(date.toString('yyyyMMdd'));
  } else {
    prop.setParameter('TZID', jstz.determine().name());
    date.setHours(dtstart.getHours());
    date.setMinutes(dtstart.getMinutes());
    date.setSeconds(dtstart.getSeconds());
    prop.setValue(date.toString('yyyyMMddTHHmmss'));
  }
  return prop;
};

});
