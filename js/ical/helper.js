/* global jstz */
define(function(require, exports, module) {
'use strict';

var ICAL = require('ext/ical');
var Calc = require('calc');

/**
 * get local timezone in the form of ICAL.Timezone
 */
exports.localTimezone = function() {
  var _calTimeOffset = function() {
    var d = new Date();
    var offset = d.getTimezoneOffset();
    var hour = Math.abs(offset) / 60;
    var minute = Math.abs(offset) % 60;
    if (hour < 10) {
      hour = '0' + hour;
    }
    if (minute < 10) {
      minute = '0' + minute;
    }
    var result = hour + ':' + minute;
    if (offset <= 0) {
      result = '+' + result;
    } else {
      result = '-' + result;
    }
    return result;
  };
  var vStandard = new ICAL.Component('standard');
  var offset = _calTimeOffset();
  var tzoffsetfrom = new ICAL.Property('tzoffsetfrom');
  tzoffsetfrom.setValue(offset);
  var tzoffsetto = new ICAL.Property('tzoffsetto');
  tzoffsetto.setValue(offset);
  var tzname = new ICAL.Property('tzname');
  tzname.setValue('CST');
  var dtstart = new ICAL.Property('dtstart');
  dtstart.setValue('1970-01-01T00:00:00');
  [tzoffsetfrom, tzoffsetto, tzname, dtstart].forEach((vProp) => {
    vStandard.addProperty(vProp);
  });
  var vTimezoneComp = new ICAL.Component('vtimezone');
  var tzid = new ICAL.Property('tzid');
  tzid.setValue(jstz.determine().name());
  vTimezoneComp.addProperty(tzid);
  vTimezoneComp.addSubcomponent(vStandard);
  var vTimezone = new ICAL.Timezone(vTimezoneComp);
  var id = vTimezone.tzid;
  if (!ICAL.TimezoneService.has(id)) {
    ICAL.TimezoneService.register(id, vTimezone);
  }
  return vTimezone;
};

/**
 * change date format from JS Date to ICAL.Time
 *
 * @param {Date} date JS Date
 * @param {ICAL.Timezone} timezone set zone property of ICAL.Time
 * @param {boolean} isDate whether it is a date or date-time
 */
exports.toICALTime = function(date, timezone, isDate) {
  if (!timezone) {
    timezone = exports.localTimezone();
  }
  var vTime = null;
  if (isDate) {
    vTime = new ICAL.Time({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      isDate: true
    }, timezone);
  } else {
    vTime = new ICAL.Time({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds()
    }, timezone);
  }
  return vTime;
};

/**
 * change date format from ICAL.Time to transport time
 *
 * @param {ICAL.Time} time the ICAL.Time to change
 */
exports.formatICALTime = function(time) {
  var zone = time.zone;
  var offset = time.utcOffset() * 1000;
  var utc = time.toUnixTime() * 1000;

  utc += offset;

  var result = {
    tzid: zone.tzid,
    // from seconds to ms
    offset: offset,
    // from seconds to ms
    utc: utc
  };

  if (time.isDate) {
    result.isDate = true;
  }

  return result;
};

/**
 * create an valarm component.
 */
exports.createVAlarm = function(alarm) {
  var vAlarm = new ICAL.Component('valarm');
  var trigger = new ICAL.Property('trigger');
  trigger.setValue(ICAL.Duration.fromSeconds(alarm.trigger));
  var action = new ICAL.Property('action');
  action.setValue(alarm.action);
  [trigger, action].forEach((prop) => {
    vAlarm.addProperty(prop);
  });
  return vAlarm;
};

/**
 * create an ICAL.Event which represent an exception event.
 */
exports.createVExEvent = function(event, parentModel) {
  var startDate = event.remote.startDate;
  var endDate = event.remote.endDate;
  var isAllDay = Calc.isAllDay(startDate, startDate, endDate);

  var vEvent = new ICAL.Event();
  var vTimezone = exports.localTimezone();
  if (isAllDay) {
    vEvent.startDate = exports.toICALTime(startDate, vTimezone, true);
    vEvent.endDate = exports.toICALTime(endDate, vTimezone, true);
  } else {
    vEvent.startDate = exports.toICALTime(startDate, vTimezone);
    vEvent.endDate = exports.toICALTime(endDate, vTimezone);
  }
  var transp = new ICAL.Property('transp');
  var recurrenceId = new ICAL.Property('recurrence-id');
  if (parentModel.isAllDay) {
    recurrenceId.setParameter('VALUE', 'DATE');
    recurrenceId.setValue(exports.toICALTime(parentModel.startDate,
      vTimezone, true));
    transp.setValue('TRANSPARENT');
  } else {
    recurrenceId.setParameter('TZID', vTimezone.tzid);
    recurrenceId.setValue(exports.toICALTime(parentModel.startDate,
      vTimezone));
    transp.setValue('OPAQUE');
  }
  var dtstamp = new ICAL.Property('dtstamp');
  dtstamp.setValue(exports.toICALTime(new Date(), vTimezone));
  var status = new ICAL.Property('status');
  status.setValue('CONFIRMED');
  [transp, recurrenceId, dtstamp, status].forEach((prop) => {
    vEvent.component.addProperty(prop);
  });
  vEvent.uid = event.remote.id;
  vEvent.description = event.remote.description;
  vEvent.location = event.remote.location;
  vEvent.summary = event.remote.title;
  vEvent.sequence = 0;
  event.remote.alarms.forEach(function(alarm) {
    vEvent.component.addSubcomponent(exports.createVAlarm(alarm));
  });
  return vEvent;
};

/**
 * update the property of ICAL.Event by the data given.
 *
 * @param {ICAL.Event} vEvent the ICAL.Event to update.
 * @param {Object} event data model used for vEvent updation.
 */
exports.updateVEvent = function(vEvent, event) {
  var startDate = event.remote.startDate;
  var endDate = event.remote.endDate;
  var isAllDay = Calc.isAllDay(startDate, startDate, endDate);
  var vTimezone = exports.localTimezone();
  if (isAllDay) {
    vEvent.startDate = exports.toICALTime(startDate, vTimezone, true);
    vEvent.endDate = exports.toICALTime(endDate, vTimezone, true);
  } else {
    vEvent.startDate = exports.toICALTime(startDate, vTimezone);
    vEvent.endDate = exports.toICALTime(endDate, vTimezone);
  }
  vEvent.summary = event.remote.title;
  vEvent.location = event.remote.location;
  vEvent.description = event.remote.description;
  vEvent.component.removeAllSubcomponents('valarm');
  event.remote.alarms.forEach(function(alarm) {
    vEvent.component.addSubcomponent(exports.createVAlarm(alarm));
  });
  vEvent.sequence = vEvent.sequence + 1;
  return vEvent;
};

exports.getFirstRecurEvent = function(vCalendar) {
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

exports.getAllFutureExEvent = function(vCalendar, startDate) {
  if (startDate instanceof Date) {
    startDate = exports.toICALTime(startDate);
  }
  return exports.getAllExEvents(vCalendar).filter((vExEvent) => {
    if (vExEvent.recurrenceId.compare(startDate) > 0) {
      return true;
    }
    return false;
  });
};

exports.getExEventByRecurId = function(vCalendar, recurrenceId) {
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
    exDateProp.resetType('date');
    exDateProp.setParameter('VALUE', 'DATE');
    exDateProp.setValue(rDate.toString('yyyy-MM-dd'));
  } else {
    var vTimezone = new ICAL.Timezone(
      vCalendar.getFirstSubcomponent('vtimezone'));
    exDateProp.setParameter('TZID', vTimezone.tzid);
    exDateProp.setValue(rDate.toString('yyyy-MM-ddTHH:mm:ss'));
  }
  exports.getFirstRecurEvent(vCalendar).component.addProperty(exDateProp);
};

exports.getPropertyValue = function(vProp, vComponent) {
  switch (vProp.name) {
    case 'exdate':
      var date = new Date(vProp.getFirstValue());
      return exports.toICALTime(date, vComponent);
  }
};
});
