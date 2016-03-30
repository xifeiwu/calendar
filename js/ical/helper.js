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

exports.getAllExEvents = function(vCalendar) {
  return vCalendar.getAllSubcomponents('vevent').map((component) => {
    return new ICAL.Event(component);
  }).filter((event) => {
    return event.isRecurrenceException();
  });
};

exports.getExceptionVEvent = function(vCalendar, recurrenceId) {
  var vEvents = exports.getAllExEvents(vCalendar);
  var vEvent = null;
  for (var i = 0; i < vEvents.length; i++) {
    if (Calc.isSameDate(Calc.dateFromTransport(recurrenceId),
        vEvents[i].recurrenceId.toJSDate())){
      vEvent = vEvents[i];
      break;
    }
  }
  return vEvent;
};

exports.addExDate = function(vCalendar, recurrenceId) {
  var exDateProp = new ICAL.Property('exdate');
  var rDate = Calc.dateFromTransport(recurrenceId);
  if (recurrenceId.isDate) {
    exDateProp.setParameter('VALUE', 'DATE');
    exDateProp.setValue(rDate.toString('yyyy-MM-dd'));
  } else {
    var vTimezone = new ICAL.Timezone(
      vCalendar.getFirstSubcomponent('vtimezone'));
    exDateProp.setParameter('TZID', vTimezone.tzid);
    exDateProp.setValue(rDate.toString('yyyy-MM-ddTHH:mm:ss'));
  }
  exports.getRecurringVEvent(vCalendar).component.addProperty(exDateProp);
};

exports.getPropertyValue = function(vProp, vComponent) {
  switch (vProp.name) {
    case 'exdate':
      var date = new Date(vProp.getFirstValue());
      return exports.toICALTime(date, vComponent);
  }
};
});
