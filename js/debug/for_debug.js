define(function(require, exports, module) {
'use strict';
var DB = require('./db');
var IcalHelper = require('ical/helper');
var dayObserver = require('day_observer');
var ICAL = require('ext/ical');
var ICALMain = require('./ical_main');
var ICALWorker = require('./ical_worker');
var ICALSimulator = require('./ical_simulator');
var ICALString = require('./ical_string');
var OptimizeRecurring = require('./optimize_recurring');

function Debug(app) {
  if (app) {
    this.app = app;
    window.app = app;
    window.forDebug = this;
  }
  this.db = new DB(this);
  this.IcalHelper = IcalHelper;
  this.dayObserver = dayObserver;
  this.icalMain = new ICALMain(this);
  this.icalMain.app = app;
  this.icalWorker = new ICALWorker(this);
  // this.icalWorker.observe();
  this.icalWorker.setIcal(ICALString.localIcalStringEveryday);
  this.icalSimulator = new ICALSimulator(this);
  this.optimizeRecurring = new OptimizeRecurring(this);
  this.expandToGlobal();
  window.addEventListener('keydown', (evt) => {
    this.debug(evt.key + ' -> ' + evt.keyCode);
    switch(evt.key) {
      case '0':
        // database related.
        this.db.deleteAllDataBase();
        // this.db.showDataBase(this.db.STORE.busytimes);
        break;
      case '7':
        // iCalendar string to event, busytime, icalComponent,
        // and related ICAL structure.
        this.icalMain.expandIcalString(ICALString.testIcalString);
        // this.icalWorker.expandIcalParameters(ICALString.localIcalStringEveryday);
        break;
      case '8':
        // event to iCalendar string.
        // this.db.showDataBase(this.db.STORE.icalComponents);
        // this.icalMain.testCreateEvent('every-2-weeks');
        this.icalMain.testCreateEvent(false, ICALString.getUID(), (err) => {
          if (err) {
            return this.debug('this.icalMain.testCreateEvent error.');
          }
          this.db.insertToDataBase(this.db.STORE.icalComponents,
            ICALString.getIcalComponents());
        });
        break;
      case '9':
        // ICAL structure.
        this.icalSimulator.simulate();
        // this.icalMain.testCreateEvent(true);
        // this.icalMain.deleteAllFuture();
        break;
      case '6':
        this.optimizeRecurring.showDayObserver();
        break;
    }
  }, true);
}
module.exports = Debug;

Debug.prototype = {
  expandToGlobal: function() {
  },

  debug: function() {
    var args = Array.prototype.slice.call(arguments).map(JSON.stringify);
    args.unshift('[calendar] ');
    args.unshift('for_debug');
    console.log.apply(console, args);
  },

  getLocalTime: function(date) {
    this.debug(date.toLocaleFormat('%Y-%m-%dT%H:%M:%S'));
  },

  setLocalTime: function (date) {
    var _mozTime = window.navigator.mozTime;
    if (!_mozTime) {
      this.debug('navigator.mozTime can not accessed.');
      return;
    }
    //specified in a ISO 8601 string (YYYY-MM-DDTHH:MM)
    _mozTime.set(date);
  }
};

});
