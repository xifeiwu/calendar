/* global jstz */
define(function(require, exports, module) {
'use strict';

var ICAL = require('ext/ical');
var Calc = require('calc');
var uuid = require('ext/uuid');

var DAY_INDEX = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * get local timezone in the form of ICAL.Timezone
 */
exports.localTimezone = function(date) {
  var _calTimeOffset = function(d) {
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
  var offset = _calTimeOffset(date);
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
 * @param {ICAL.Timezone|boolean} timezone if the type of timezone is
 * ICAL.Timezone or null, the type of ICAL.Time returned is date-time.
 * If the value of timezone is true, the type of ICAL.Time returned is
 * date, as timezone info is useless for date.
 */
exports.toICALTime = function(date, timezone) {
  var isDate = false;
  if (!timezone) {
    timezone = exports.localTimezone(date);
  } else if (timezone === true) {
    isDate = true;
  }
  var vTime = null;
  if (isDate) {
    vTime = new ICAL.Time({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      isDate: true
    }, ICAL.Timezone.localTimezone);
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
 * create ICAL.Property of rrule.
 */
exports.createRrule = function(event) {
  var rRule = new ICAL.Property('rrule');
  var props = {};
  var startDate = event.remote.startDate;
  switch (event.remote.repeat) {
    case 'every-day':
      props.freq = 'DAILY';
      break;
    case 'every-week':
      props.freq = 'WEEKLY';
      props.byday = DAY_INDEX[startDate.getDay()];
      break;
    case 'every-2-weeks':
      props.freq = 'WEEKLY';
      props.interval = 2;
      props.byday = DAY_INDEX[startDate.getDay()];
      break;
    case 'every-month':
      props.freq = 'MONTHLY';
      props.bymonthday = startDate.getDate();
      break;
    case 'every-year':
      // XXX: Since ical.js cannot handle 2.29 in leap year with YEARLY,
      // so useing 12*month here instead of YEARLY as a workaround.
      props.freq = 'MONTHLY';
      props.interval = 12;
      props.bymonthday = startDate.getDate();
      break;
  }
  var recur = new ICAL.Recur(props);
  rRule.setValue(recur);
  return rRule;
};

/**
 * create an ICAL.Event which represent an exception event.
 */
exports.createVEvent = function(event, parentModel) {
  var startDate = event.remote.startDate;
  var endDate = event.remote.endDate;
  var isAllDay = Calc.isAllDay(startDate, startDate, endDate);

  var vEvent = new ICAL.Event();
  var vTimezone = exports.localTimezone(startDate);
  var rrule = exports.createRrule(event);
  var transp = new ICAL.Property('transp');
  if (isAllDay) {
    vEvent.startDate = exports.toICALTime(startDate, true);
    vEvent.endDate = exports.toICALTime(endDate, true);
    transp.setValue('TRANSPARENT');
  } else {
    vEvent.startDate = exports.toICALTime(startDate, vTimezone);
    vEvent.endDate = exports.toICALTime(endDate, vTimezone);
    transp.setValue('OPAQUE');
  }
  var dtstamp = new ICAL.Property('dtstamp');
  dtstamp.setValue(exports.toICALTime(new Date(), vTimezone));
  var status = new ICAL.Property('status');
  status.setValue('CONFIRMED');
  [rrule, transp, dtstamp, status].forEach((prop) => {
    vEvent.component.addProperty(prop);
  });
  vEvent.uid = uuid();
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
 * create a vCalendar object using data of event given.
 */
exports.createVCalendar = function(event) {
  var vCalendar = new ICAL.Component('vcalendar');
  var peroid = new ICAL.Property('peroid');
  peroid.setValue('-//H5OS//Calendar 1.0//EN');
  var version = new ICAL.Property('version');
  version.setValue('2.0');
  [peroid, version].forEach((prop) => {
    vCalendar.addProperty(prop);
  });
  var localTimezone = exports.localTimezone(event.remote.startDate).component;
  var recurEvent = exports.createVEvent(event).component;
  [localTimezone, recurEvent].forEach((comp) => {
    vCalendar.addSubcomponent(comp);
  });
  return vCalendar;
};

/**
 * create an ICAL.Event which represent an exception event.
 */
exports.createVExEvent = function(event, parentModel) {
  var startDate = event.remote.startDate;
  var endDate = event.remote.endDate;
  var isAllDay = Calc.isAllDay(startDate, startDate, endDate);

  var vEvent = new ICAL.Event();
  var vTimezone = exports.localTimezone(startDate);
  if (isAllDay) {
    vEvent.startDate = exports.toICALTime(startDate, true);
    vEvent.endDate = exports.toICALTime(endDate, true);
  } else {
    vEvent.startDate = exports.toICALTime(startDate, vTimezone);
    vEvent.endDate = exports.toICALTime(endDate, vTimezone);
  }
  var transp = new ICAL.Property('transp');
  var recurrenceId = new ICAL.Property('recurrence-id');
  if (parentModel.isAllDay) {
    recurrenceId.setParameter('VALUE', 'DATE');
    recurrenceId.setValue(exports.toICALTime(parentModel.startDate, true));
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
  var vTimezone = exports.localTimezone(startDate);
  if (isAllDay) {
    vEvent.startDate = exports.toICALTime(startDate, true);
    vEvent.endDate = exports.toICALTime(endDate, true);
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
