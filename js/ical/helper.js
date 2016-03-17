/* global jstz */
define(function(require, exports, module) {
'use strict';

var ICAL = require('ext/ical');
var Calc = require('calc');

exports.toICALTime = function(date, timezone) {
  return new ICAL.Time({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds()
  }, timezone);
};

exports.getRecurringVEvent = function(vCalendar) {
  var vEventComps = vCalendar.getAllSubcomponents('vevent');
  var vEvent = null;
  for (var i = 0; i < vEventComps.length; i++) {
    var vComp = vEventComps[i];
    if (vComp.hasProperty('rrule') || vComp.hasProperty('rdate')) {
      vEvent = new ICAL.Event(vComp);
      break;
    }
  }
  return vEvent;
};

exports.getExceptionVEvent = function(vCalendar, recurrenceId) {
  var vEventComps = vCalendar.getAllSubcomponents('vevent');
  var vEvent = null;
  for (var i = 0; i < vEventComps.length; i++) {
    var vTime = vEventComps[i].getFirstPropertyValue('recurrence-id');
    if (vTime && Calc.isSameDate(
        Calc.dateFromTransport(recurrenceId),
        vTime.toJSDate())){
      vEvent = new ICAL.Event(vEventComps[i]);
      break;
    }
  }
  return vEvent;
};

exports.addExDate = function(vCalendar, recurrenceId) {
  var exDateProp = new ICAL.Property('EXDATE');
  var rDate = Calc.dateFromTransport(recurrenceId);
  if (recurrenceId.isDate) {
    exDateProp.setParameter('VALUE', 'DATE');
    exDateProp.setValue(rDate.toString('yyyyMMdd'));
  } else {
    var vTimezone = new ICAL.Timezone(
      vCalendar.getFirstSubcomponent('vtimezone'));
    exDateProp.setParameter('TZID', vTimezone.tzid);
    exDateProp.setValue(rDate.toString('yyyyMMddTHHmmss'));
  }
  exports.getRecurringVEvent(vCalendar).component.addProperty(exDateProp);
};

});
