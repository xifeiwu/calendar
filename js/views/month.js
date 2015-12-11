define(function(require, exports, module) {
'use strict';

var Calc = require('calc');
var GestureDetector = require('shared/gesture_detector/gesture_detector');
var SingleMonth = require('./single_month');
var View = require('view');
var dateFromId = Calc.dateFromId;
var monthStart = Calc.monthStart;
var performance = require('performance');
var router = require('router');
var debug = require('debug')('month');
var navigationHandler = require('navigation_handler');
var InputParser = require('shared/input_parser/input_parser');
require('shared/h5-option-menu/dist/amd/script');
var CalendarChooser = require('views/calendar_chooser');
var _ = navigator.mozL10n.get;

// minimum difference between X and Y axis to be considered an horizontal swipe
var XSWIPE_OFFSET = window.innerWidth / 10;

function Month() {
  View.apply(this, arguments);
  this.frames = new Map();
  window.addEventListener('localized', this);
  this.datePicker = document.getElementById('date-picker');
  this.datePicker.addEventListener('input', function(evt) {
    this._goToDay(new Date(evt.target.value));
  }.bind(this));
  this.datePicker.addEventListener('blur', function(evt) {
    navigationHandler.getCurItem().focus();
  }.bind(this));

  var keys = ['month-view-current-date', 'month-view-go-to-date',
    'month-view-calendars-to-display', 'month-view-settings'];
  var items = [];
  keys.forEach(function(name) {
    items.push({
      title: _(name),
      key: name
    });
  });

  this.optionMenu = document.body.querySelector('h5-option-menu');
  this.optionMenu.setOptions({
    items: items
  });

  this.optionMenu.on('h5options:closed', function() {
    debug('h5options:closed.');
    if (this.optionMenu.contains(document.activeElement)) {
      navigationHandler.getCurItem().focus();
    }
  }.bind(this));

  this.optionMenu.on('h5options:opened', function() {
    debug('h5options:opened');
  }.bind(this));

  this.optionMenu.on('h5options:selected', function(e) {
    var optionKey = e.detail.key;
    debug('h5options:selected, key is ' + optionKey);
    switch(optionKey) {
      case 'month-view-current-date':
        this._goToDay(new Date());
        break;
      case 'month-view-go-to-date':
        this.datePicker.value =
          InputParser.exportDate(this.controller.selectedDay);
        this.datePicker.focus();
        break;
      case 'month-view-calendars-to-display':
        this.calendarChooser.show();
        break;
      case 'month-view-settings':
        router.go('/advanced-settings/');
        break;
      case 'month-view-sync-calendar':
        console.log('month-view-sync-calendar click');
        this.app.syncController.all();
        break;
    }
  }.bind(this));

  this.calendarChooser = new CalendarChooser({ app: this.app });
  this.calendarChooser.event.on('hide', function() {
    navigationHandler.getCurItem().focus();
  });

  var _observeSyncFreq = function(syncFreq) {
    var keys = ['month-view-current-date', 'month-view-go-to-date',
      'month-view-calendars-to-display', 'month-view-settings'];
    if (syncFreq == null) {
      keys.push('month-view-sync-calendar');
    }
    var items = [];
    keys.forEach(function(name) {
      items.push({
        title: _(name),
        key: name
      });
    });
    this.optionMenu.setOptions({
      items: items
    });
  }.bind(this);

  var setting = this.app.store('Setting');
  setting.on('syncFrequencyChange', _observeSyncFreq);
  setting.getValue('syncFrequency', function(err, value) {
    if (!err) {
      _observeSyncFreq(value);
    }
  });

  this._keyDownHandler = this._keyDownEvent.bind(this);
}
module.exports = Month;

Month.prototype = {
  __proto__: View.prototype,

  SCALE: 'month',

  selectors: {
    element: '#month-view',
  },

  date: null,

  /** @type {SingleMonth} */
  currentFrame: null,

  /** @type {DOMElement} used to detect if dbltap happened on same date */
  _lastTarget: null,

  /**
   * store current, previous and next months
   * we load them beforehand and keep on the cache to speed up swipes
   * @type {Array<SingleMonth>}
   */
  frames: null,

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    this.app.timeController.scale = this.SCALE;
    if (this.currentFrame) {
      this.currentFrame.activate();
    }
    this.element.addEventListener('keydown', this._keyDownHandler);
  },

  _onswipe: function(data) {
    // only move to a different month if it's an horizontal swipe
    if (Math.abs(data.dy) > (Math.abs(data.dx) - XSWIPE_OFFSET)) {
      return;
    }
    var dir = document.documentElement.dir === 'rtl' ? -1 : 1;
    this._move(dir * data.dx < 0);
  },

  _onwheel: function(event) {
    // mouse wheel is used for a10y
    if (event.deltaMode !== event.DOM_DELTA_PAGE || event.deltaX === 0) {
      return;
    }
    this._move(event.deltaX > 0);
  },

  _move: function(isNext) {
    var controller = this.app.timeController;
    var date = isNext ? this._nextTime() : this._previousTime();
    // If we changed months, set the selected day to the 1st
    controller.selectedDay = date;
    controller.move(date);
  },

  _nextTime: function() {
    return monthStart(this.date, 1);
  },

  _previousTime: function() {
    return monthStart(this.date, -1);
  },

  _initEvents: function() {
    this.controller = this.app.timeController;

    this.element.addEventListener('swipe', this);
    this.element.addEventListener('wheel', this);
    this.controller.on('monthChange', this);
    this.delegate(this.element, 'click', '.month-day', this);
    this.delegate(this.element, 'dbltap', '.month-day', this);

    /**
     * This is the place where GestureDetector used to start.
     * The location of require is: 'shared/gesture_detector/gesture_detector'
     * GestureDetector will be closed later.
     */
    this.gd = new GestureDetector(this.element);
    this.gd.startDetecting();
    navigationHandler.start();
  },

  _goToDay: function(date) {
    this.controller.move(date);
    this.controller.selectedDay = date;
    var evt = new CustomEvent('h5os-date-changed', {
      detail: {
        toDate: date
      },
      bubbles: true,
      cancelable: false
    });
    document.dispatchEvent(evt);
  },

  _postMonthChanged: function(delta) {
    var item = navigationHandler.getCurItem();
    var currentDate = dateFromId(item.dataset.date);
    var nextDate  = this._getDay(currentDate, delta);

    this.controller.move(nextDate);
    var evt = new CustomEvent('h5os-date-changed', {
      detail: {
        toDate: nextDate
      },
      bubbles: true,
      cancelable: false
    });

    document.dispatchEvent(evt);
  },

  _getDay: function(date , count) {
    var yesterdayAllMilliseconds = date.getTime() - count * 1000 * 60 * 60 * 24;
    var today = new Date();
    today.setTime(yesterdayAllMilliseconds);
    var tempHour = today.getHours();
    var tempDate = today.getDate();
    if (tempHour >= 12) {
      today.setDate(tempDate + 1);
      today.setHours(0);
    }
    return today;
  },

  _keyDownEvent: function(evt) {
    var postMonthChanged = false;
    if (this.app.softKey === undefined) {
      debug('_keyDownEvent, ' + evt.target.id + ': ' + evt.key);
      switch(evt.key) {
        case 'BrowserBack':
          window.close();
          break;
        case 'ArrowLeft':
          if (evt.target.style.getPropertyValue('--pre-month-1')) {
            this._postMonthChanged(1);
            postMonthChanged = true;
          }
          break;
        case 'ArrowRight':
          if (evt.target.style.getPropertyValue('--next-month-1')) {
            this._postMonthChanged(-1);
            postMonthChanged = true;
          }
          break;
        case 'ArrowDown':
          if (evt.target.style.getPropertyValue('--next-month-7')) {
            this._postMonthChanged(-7);
            postMonthChanged = true;
          }
          break;
        case 'ArrowUp':
          if (evt.target.style.getPropertyValue('--pre-month-7')) {
            this._postMonthChanged(7);
            postMonthChanged = true;
          }
          break;
        case 'AcaSoftLeft':
          this._goToAddEvent();
          break;
        case 'Enter':
          debug('View Event List.');
          router.go('/event/list/');
          break;
        case 'AcaSoftRight':
          this.optionMenu.open();
          break;
      }
    } else {
      switch (evt.key) {
        case 'BrowserBack':
          break;
        case 'Enter':
        case 'Accept':
          break;
      }
    }
    if (!postMonthChanged) {
      navigationHandler.handleKeyEvent(evt);
    }
    var date = dateFromId(navigationHandler.getCurItem().dataset.date);
    this.controller.selectedDay = date;
    evt.stopPropagation();
  },

  handleEvent: function(e, target) {
    switch (e.type) {
      case 'swipe':
        this._onswipe(e.detail);
        break;
      case 'wheel':
        this._onwheel(e);
        break;
      case 'click':
        var date = dateFromId(target.dataset.date);
        this.controller.selectedDay = date;
        break;
      case 'dbltap':
        // make sure we discard double taps that started on a different day
        if (this._lastTarget === target) {
          this._goToAddEvent();
        }
        break;
      case 'monthChange':
        this.changeDate(e.data[0]);
        break;
      case 'localized':
        this.reconstruct();
        break;
    }
    this._lastTarget = target;
  },

  _goToAddEvent: function(date) {
    // slight delay to avoid tapping the elements inside the add event screen
    setTimeout(() => {
      // don't need to set the date since the first tap triggers a click that
      // sets the  timeController.selectedDay
      router.go('/event/add/');
    }, 50);
  },

  changeDate: function(time) {
    this.date = monthStart(time);

    if (this.currentFrame) {
      this.currentFrame.deactivate();
    }

    this.currentFrame = this._getFrame(this.date);

    this._trimFrames();
    this._appendFrames();

    this.currentFrame.activate();
  },

  _getFrame: function(date) {
    var id = date.getTime();
    var frame = this.frames.get(id);
    if (!frame) {
      frame = new SingleMonth({
        app: this.app,
        date: date,
        container: this.element
      });
      frame.create();
      this.frames.set(id, frame);
    }
    return frame;
  },

  _trimFrames: function() {
    if (this.frames.size <= 3) {
      return;
    }

    // full month (we always keep previous/next months)
    var delta = 31 * 24 * 60 * 60 * 1000;

    this.frames.forEach((frame, ts) => {
      var base = Number(this.date);
      if (Math.abs(base - ts) > delta) {
        frame.destroy();
        this.frames.delete(ts);
      }
    });
  },

  _appendFrames: function() {
    // sort elements by timestamp (key = timestamp) so DOM makes more sense
    Array.from(this.frames.keys())
    .sort((a, b) => a - b)
    .forEach(key => this.frames.get(key).append());
  },

  oninactive: function() {
    View.prototype.oninactive.call(this);
    if (this.currentFrame) {
      this.currentFrame.deactivate();
    }
    this.element.removeEventListener('keydown', this._keyDownHandler);
  },

  onfirstseen: function() {
    this._initEvents();
    this.changeDate(this.controller.month);
    performance.monthReady();
  },

  destroy: function() {
    this.frames.forEach((frame, key) => {
      this.frames.delete(key);
      frame.destroy();
    });
  },

  reconstruct: function() {
    // Watch for changed value from transition of a locale to another
    this.destroy();
    this.changeDate(this.controller.month);
  }

};

});
