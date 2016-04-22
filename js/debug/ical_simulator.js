/* global jstz */
define(function(require, exports, module) {
'use strict';
var ICAL = require('ext/ical');
var Calc = require('calc');
var ICALString = require('./ical_string');

function ICALSimulator(forDebug) {
  this.forDebug = forDebug;
  this.debug = forDebug.debug;
}
module.exports = ICALSimulator;

ICALSimulator.prototype = {
  simulate: function(iCalString) {
    // this._createExDate();
    // this.propertyAndValue();
    // this.createAlarm();
    // this.createVRule();
    // this._testICALTime();
    // this._showVEventProperties();
    this._createVCalendar();
  },

  _showICALComponent: function(vComponent) {
    this.debug('> show ' + vComponent.name);
    console.log(vComponent.toString());
    console.log(vComponent);
    console.log(vComponent.getAllProperties());
  },

  _showICALProperty: function(vProperty) {
    this.debug('> show ' + vProperty.name);
    console.log(vProperty.toICAL());
    console.log(vProperty);
  },


  _showVEventProperties: function(iCalString) {
    var eventString = 'BEGIN:VEVENT\r\nDTSTART;TZID=Asia/Shanghai:20160101T010000\r\nDTEND;TZID=Asia/Shanghai:20160101T020000\r\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH\r\nDTSTAMP;TZID=Asia/Shanghai:20160112T011838\r\nUID:628b1af5-f151-43e0-a86d-5c2d1aad4260\r\nDESCRIPTION:\r\nLOCATION:\r\nSEQUENCE:0\r\nSTATUS:CONFIRMED\r\nSUMMARY:Title\r\nTRANSP:OPAQUE\r\nEND:VEVENT';
    var vEventComp = ICAL.Component.fromString(eventString);
    var vEvent = new ICAL.Event(vEventComp);
    this.debug('> All properties of iCalEvent: ');
    this.debug(vEventComp.getAllProperties());

    var rRule = vEventComp.getFirstPropertyValue('rrule');
    this.debug('> The object format of newRrule: ');
    this.debug(rRule);
    this.debug('> freq: ' + rRule.freq);
    this.debug('> interval: ' + rRule.interval);
    this.debug('> byday: ' + rRule.byday);
  },

  _testICALTime: function() {
    var showTime = function(date) {
      console.log(date.toString('yyyy-MM-ddTHH:mm:ss'));
      console.log(date.getTime());
    }.bind(this);
    var showICALTime = function(vTime) {
    }.bind(this);

    var withTimezone = function() {
      var now = new Date();
      showTime(now);

      var vTimezone = this.localTimezone();
      var startDate = this.toICALTime(now);

      var endDate = new ICAL.Time();
      endDate.fromUnixTime(now.getTime() / 1000);
      endDate.zone = ICAL.Timezone.utcTimezone;

      var endDate2 = endDate.convertToZone(this.localTimezone());
      var endDate3 = endDate.convertToZone(ICAL.Timezone.localTimezone);

      console.log('startDate:');
      console.log(startDate);
      console.log(this.formatICALTime(startDate));
      console.log('endDate:');
      console.log(endDate);
      console.log(this.formatICALTime(endDate));
      console.log('endDate2:');
      console.log(endDate2);
      console.log(this.formatICALTime(endDate2));
      console.log('endDate3:');
      console.log(endDate3);
      console.log(this.formatICALTime(endDate3));
    }.bind(this);
    withTimezone();

    var vTimeProperty = function() {
      var custom = new Date(2016, 2, 1);
      var startDate = this.toICALTime(custom);
      startDate.adjust(-(startDate.dayOfWeek() - 1), 0, 0, 0);
      // startDate.addDuration({
      //   isNegative: true,
      //   weeks: 20
      // })
      startDate.adjust(0, 0, 0, 0);
      console.log('startDate:');
      console.log(startDate);
      console.log(this.formatICALTime(startDate));
      console.log('dayOfWeek:' + startDate.dayOfWeek());

    }.bind(this);
    // vTimeProperty();

  },

  _createVCalendar: function() {
    var vCalendar = new ICAL.Component('vcalendar');
    var peroid = new ICAL.Property('peroid');
    peroid.setValue('-//H5OS//Calendar 1.0//EN');
    var version = new ICAL.Property('version');
    version.setValue('2.0');
    [peroid, version].forEach((prop) => {
      vCalendar.addProperty(prop);
    });
    console.log(vCalendar.toString());
  },

  _createExDate: function() {
    var now = new Date();
    var allDay = new ICAL.Property('exdate');
    allDay.isDecorated = true;
    var normal = new ICAL.Property('exdate');
    normal.isDecorated = false;
    allDay.resetType('date');
    allDay.setParameter('VALUE', 'DATE');
    allDay.setValue(now.toString('yyyy-MM-dd'));
    normal.setParameter('TZID', 'Asia/Shanghai');
    normal.setValue(now.toString('yyyy-MM-ddTHH:mm:ss'));
    console.log(allDay.toICAL());
    console.log(allDay);
    console.log(allDay.getFirstValue());
    console.log('allDay isDate:' + allDay.getFirstValue().isDate);
    // console.log('allDay VALUE:' + allDay.getParameter('VALUE'));
    console.log('allDay is Date:' + (allDay.getParameter('VALUE') === 'DATE'));
    console.log(normal.toICAL());
    console.log(normal);
    console.log(normal.getFirstValue());
    console.log('normal isDate:' + normal.getFirstValue().isDate);
    console.log('allDay isDate:' + normal.getParameter('VALUE') === 'DATE');
  },

  _createVAlarm: function() {
    var showVAlarm = function() {
      var alarmString = 'BEGIN:VALARM\r\nTRIGGER:-PT5M\r\n' +
      'ACTION:DISPLAY\r\nEND:VALARM';
      var vAlarm = new ICAL.Component.fromString(alarmString);
      this._showICALComponent(vAlarm);
    }.bind(this);
    showVAlarm();
    var vAlarm = new ICAL.Component('valarm');
    var trigger = new ICAL.Property('trigger');
    trigger.setValue(ICAL.Duration.fromSeconds(400));
    var action = new ICAL.Property('action');
    action.setValue('DISPLAY');
    [trigger, action].forEach((prop) => {
      vAlarm.addProperty(prop);
    });
    this._showICALComponent(vAlarm);
  },

  _createVRule: function() {
    var showVRule = function() {
      var rruleString = 'RRULE:FREQ=WEEKLY;BYDAY=FR';
      var vRule = ICAL.Property.fromString(rruleString);
      this._showICALProperty(vRule);
    }.bind(this);
    showVRule();
    var vRule = new ICAL.Property('rrule');
    var vRecur = new ICAL.Recur({
      freq: 'WEEKLY',
      byday: 'FR'
    });
    vRule.setValue(vRecur);
    this._showICALProperty(vRule);
  },

  /**
   * This function is used to show the relation between
   * ICAL.Property and ICAL.Time
   */
  propertyAndValue: function() {
    var vEvent = new ICAL.Event();
    var vTimezone = this.localTimezone();
    var startDate = this.toICALTime(new Date(), vTimezone);
    vEvent.startDate = startDate;
    var endDate = this.toICALTime(new Date(), vTimezone, true);
    vEvent.endDate = endDate;
    var transp = new ICAL.Property('transp');
    transp.setValue('TRANSPARENT');
    vEvent.component.addProperty(transp);
    console.log(vEvent);
    console.log(vEvent.toString());
    console.log(vEvent.startDate);
    setTimeout(() => {
      console.log(vEvent);
    }, 10);
  },

  /**
   * This is a function for showing the structure and api 
   * provided by ICAL component.
   */
  testExtICAL: function(iCalString) {
    if (!iCalString) {
      iCalString = ICALString.googleIcalString;
    }

    // structure of ICAL.Component
    console.log('>>>>>>>>>>>>>>>>>>structure of ICAL.Component');
    var iCalComp = ICAL.Component.fromString(iCalString);
    var iCalString2 = iCalComp.toString();
    this.debug('> 1.The string format of iCalComp: ' + iCalComp);
    this.debug('> 2.And they are ' +
      (iCalString === iCalString2 ? 'indeed' : 'not') +
      ' the same.');
    this.debug('> 3.The Object format of iCalComp:');
    console.log(iCalComp);
    this.debug('> 4.getAllSubcomponents of vevent:');
    console.log(iCalComp.getAllSubcomponents('vevent'));

    // structure of ICAL.Event
    console.log('>>>>>>>>>>>>>>>>>>structure of recurring ICAL.Event');
    var iCalEvent = new ICAL.Event(iCalComp.getFirstSubcomponent('vevent'));
    var vEventComps = iCalComp.getAllSubcomponents('vevent');
    var i = 0;
    var len = vEventComps.length;
    for (; i < len; i++) {
      iCalEvent = new ICAL.Event(vEventComps[i]);
      if (iCalEvent.isRecurring()) {
        break;
      }
    }
    this.debug('> 1.The string format of iCalEvent: ' + iCalEvent);
    this.debug('> 2.The Object format of iCalEvent:');
    console.log(iCalEvent);
    this.debug('> 3.All Properties of iCalEvent:');
    console.log(iCalEvent.component.getAllProperties());
    this.debug('> 4.Some important properties of iCalEvent:');
    this.debug('uid: ' + iCalEvent.uid);
    this.debug('summary: ' + iCalEvent.summary);
    this.debug('startDate: ' + iCalEvent.startDate);
    console.log(iCalEvent.startDate);
    this.debug('endDate: ' + iCalEvent.endDate);
    console.log(iCalEvent.endDate);

    // structure of ICAL.Time
    console.log('>>>>>>>>>>>>>>>>>>structure of ICAL.Time');
    var iCalTime = iCalEvent.startDate;
    this.debug('> 1.The string format of iCalTime: ' + iCalTime);
    this.debug('> 2.The Object format of iCalTime:');
    console.log(iCalTime);
    var zone = iCalTime.zone;
    var offset = iCalTime.utcOffset() * 1000;
    var utc = iCalTime.toUnixTime() * 1000;
    utc += offset;
    var result = {
      tzid: zone.tzid,
      // from seconds to ms
      offset: offset,
      // from seconds to ms
      utc: utc
    };
    this.debug('> 3.The value of result: ');
    console.log(result);


    console.log('>>>>>>>>>>>>>>>>>>structure of ICAL.Timezone');
    var vTimezone = new ICAL.Timezone(iCalComp.getFirstSubcomponent('vtimezone'));
    this.debug('> 1.The string format of vTimezone: ' + vTimezone);
    this.debug('> 2.The Object format of vTimezone:');
    console.log(vTimezone);
    var iCalTimezone = iCalTime.zone;
    this.debug('> 1.The string format of iCalTimezone: ' + iCalTimezone);
    this.debug('> 2.The Object format of iCalTimezone:');
    console.log(iCalTimezone);

    // structure of ICAL.Property
    console.log('>>>>>>>>>>>>>>>>>>structure of ICAL.Property');
    var startDate = iCalEvent.startDate;
    var date = new Date();
    var iCalProp = new ICAL.Property('EXDATE');
    iCalProp.isMultiValue = true;
    iCalProp.setParameter('VALUE', 'DATE');
    iCalProp.setParameter('TZID', jstz.determine().name());
    iCalProp.setParameter('PARAM1', 'PARAM1');
    iCalProp.setValue([date.toString('yyyyMMddTHHmmss'), 'value of today']);
    //[date.toString('yyyyMMddTHHmmss'), 'value of today']
    //date.toString('yyyyMMddTHHmmss')
    this.debug('> 1. The string format of iCalProp: ' + iCalProp.toICAL());
    this.debug('> 2. The Object format of iCalProp:');
    console.log(iCalProp);
  },

  deleteFutureEvents: function() {
    function allProperties(component) {
      console.log('> All Properties of iCalComponent:');
      console.log(component.getAllProperties());
    }
    // The main point is operation of ICAL.Event
    var eventString = 'BEGIN:VEVENT\r\nDTSTART;TZID=Asia/Shanghai:20160101T010000\r\nDTEND;TZID=Asia/Shanghai:20160101T020000\r\nRRULE:FREQ=DAILY\r\nDTSTAMP;TZID=Asia/Shanghai:20160112T011838\r\nUID:628b1af5-f151-43e0-a86d-5c2d1aad4260\r\nDESCRIPTION:\r\nLOCATION:\r\nSEQUENCE:0\r\nSTATUS:CONFIRMED\r\nSUMMARY:Title\r\nTRANSP:OPAQUE\r\nEND:VEVENT';
    var vEventComp = ICAL.Component.fromString(eventString);
    var vEvent = new ICAL.Event(vEventComp);
    allProperties(vEvent.component);

    var rRule = vEventComp.getFirstPropertyValue('rrule');
    this.debug('> The object format of rrule:');
    console.log(rRule);
    this.debug('> The string format of rRule: ' + rRule.toString());
    var untilDate = new Date(vEvent.startDate);
    untilDate.setMonth(untilDate.getMonth() + 1);
    rRule.until = untilDate.toString('yyyy-MM-ddTHH:mm:ss');
    this.debug('> The object format of rrule:');
    console.log(rRule);
    this.debug('> The string format of rRule: ' + rRule.toString());
    vEventComp.updatePropertyWithValue('rrule', rRule);
  },

  deleteThisOnly: function() {
    function allProperties(component) {
      console.log('> All Properties of iCalComponent:');
      console.log(component.getAllProperties());
      console.log(component.toString());
    }
    // The main point is operation of ICAL.Event
    var iCalString = ICALString.localIcalString;
    var vCalendar = ICAL.Component.fromString(iCalString);
    var vTimezoneComp = vCalendar.getFirstSubcomponent('vtimezone');
    var vTimezone = new ICAL.Timezone(vTimezoneComp);
    var vEventComp = vCalendar.getFirstSubcomponent('vevent');
    var vEvent = new ICAL.Event(vEventComp);
    var exDate = vEvent.startDate.clone();
    exDate.resetTo(exDate.year, exDate.month, exDate.day + 14,
      exDate.hour, exDate.minute, exDate.second, exDate.zone);

    var exDateProp = new ICAL.Property('EXDATE');
    exDateProp.setParameter('TZID', vTimezone.tzid);
    exDateProp.setValue(exDate.toJSDate().toString('yyyyMMddTHHmmss'));
    vEventComp.addProperty(exDateProp);
    // allProperties(vEventComp);
    this.expandIcalString(vCalendar.toString());
  },

  registTimeZone: function(iCalString) {
    function _showTimezone() {
      var timezoneString = 'BEGIN:VTIMEZONE\r\nTZID:Asia/Shanghai\r\nX-LIC-LOCATION:Asia/Shanghai\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:+0800\r\nTZOFFSETTO:+0800\r\nTZNAME:CST\r\nDTSTART:19700101T000000\r\nEND:STANDARD\r\nEND:VTIMEZONE';
      var vTimezoneComp = ICAL.Component.fromString(timezoneString);
      var vTimezone = new ICAL.Timezone(vTimezoneComp);
      this._showICALComponent(vTimezoneComp);
      var vStandard = vTimezoneComp.getFirstSubcomponent('standard');
      this._showICALComponent(vStandard);
    }
    _showTimezone.call(this);
    this.localTimezone();
  },

  localTimezone: function() {
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
  },

  toICALTime: function(date, timezone, isDate) {
    if (!timezone) {
      timezone = this.localTimezone();
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
  },
  /**
   * Takes an ICAL.Time object and converts it
   * into the storage format familiar to the calendar app.
   *
   *    var time = new ICAL.Time({
   *      year: 2012,
   *      month: 1,
   *      day: 1,
   *      zone: 'PST'
   *    });
   *
   *    // time is converted to a MS
   *    // then its UTC offset is added
   *    // so the time is at UTC (offset 0) then the
   *    // offset is associated with that time.
   *
   *    var output = {
   *      utc: ms,
   *      offset: (+|-)ms,
   *      // zone can mostly be ignored except
   *      // in the case where the event is "floating"
   *      // in time and we need to convert the utc value
   *      // to the current local time.
   *      tzid: ''
   *    };
   */
  formatICALTime: function(time) {
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
  },
};

});
