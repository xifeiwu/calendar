/* global softkeyHandler */
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
var InputParser = require('shared/input_parser/input_parser');
var CalendarChooser = require('views/calendar_chooser');
var _ = navigator.mozL10n.get;

// minimum difference between X and Y axis to be considered an horizontal swipe
var XSWIPE_OFFSET = window.innerWidth / 10;

function Month() {
  View.apply(this, arguments);
  this.frames = new Map();
  window.addEventListener('localized', this);
  this.datePicker = document.getElementById('month-view-date-picker');
  this.datePicker.addEventListener('input', function(evt) {
    this._goToDay('selected-day', new Date(evt.target.value));
  }.bind(this));
  this.datePicker.addEventListener('blur', function(evt) {
    this._getCurFocus().focus();
  }.bind(this));

  // XXX: disable sync function for now
  if (this.app.isOnlineModificationEnable()) {
    // get and observe syncFrequency to determine
    // whether to show 'Sync Calendar' or not
    this.needShowSyncCalendar = false;
    var setting = this.app.store('Setting');
    setting.getValue('syncFrequency', function(err, value) {
      if (!err && (value === 0)) {
        this.needShowSyncCalendar = true;
      } else {
        this.needShowSyncCalendar = false;
      }
    }.bind(this));
    setting.on('syncFrequencyChange', function(syncFreq) {
      if (syncFreq === 0) {
        this.needShowSyncCalendar = true;
      } else {
        this.needShowSyncCalendar = false;
      }
    }.bind(this));
  } else {
    this.needShowSyncCalendar = false;
  }

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

  calendarChooser: null,
  /**
   * store current, previous and next months
   * we load them beforehand and keep on the cache to speed up swipes
   * @type {Array<SingleMonth>}
   */
  frames: null,

  SPANOFDAY: Calc.HOUR * 24,
  SPANOFWEEK: Calc.HOUR * 24 * 7,

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    this.app.timeController.scale = this.SCALE;
    if (this.currentFrame) {
      this.currentFrame.activate();
    }
    this.element.addEventListener('keydown', this._keyDownHandler);
    this._goToDay('default-day');
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
  },

  _goToDay: function(type, date) {
    var newDate = null;
    switch (type) {
      case 'current-day':
        newDate = new Date();
        break;
      case 'selected-day':
        newDate = new Date(date.getTime() +
          date.getTimezoneOffset() * 60 * 1000);
        break;
      case 'default-day':
        newDate = this.controller.selectedDay;
        if (!newDate) {
          newDate = this.controller.position;
        }
        break;
    }
    if (newDate) {
      this.controller.move(newDate);
      this.controller.selectedDay = newDate;
      this.changeFocus(newDate);
    }
  },

  _changeSelectedDay: function(direction) {
    var curDay = this.app.timeController.selectedDay;
    var dstDay = null;
    switch (direction) {
      case 'ArrowRight':
        dstDay = new Date(curDay.getTime() + this.SPANOFDAY);
        break;
      case 'ArrowLeft':
        dstDay = new Date(curDay.getTime() - this.SPANOFDAY);
        break;
      case 'ArrowDown':
        dstDay = new Date(curDay.getTime() + this.SPANOFWEEK);
        break;
      case 'ArrowUp':
        dstDay = new Date(curDay.getTime() - this.SPANOFWEEK);
        break;
    }
    this.controller.move(dstDay);
    this.controller.selectedDay = dstDay;
    this.changeFocus(dstDay);
  },

  _keyDownEvent: function(evt) {
    switch (evt.key) {
      case 'AcaSoftLeft':
        if (!this.app.syncController.isRunning) {
          router.go('/event/add/');
        }
        evt.preventDefault();
        break;
      case 'Enter':
        debug('View Event List.');
        var emptyList = document.activeElement.getAttribute('role');
        if (emptyList === 'gridcell') {
          router.go('/event/list/');
        }
        break;
      case 'AcaSoftRight':
        this._showOptionMenu();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowDown':
      case 'ArrowUp':
        this._changeSelectedDay(evt.key);
        break;
    }
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
          router.go('/event/add/');
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

  _showOptionMenu: function() {
    var keys = ['month-view-current-date', 'month-view-go-to-date',
      'month-view-calendars-to-display', 'month-view-settings'];
    if (this.needShowSyncCalendar) {
      keys.push('month-view-sync-calendar');
    }
    var currentAction = '';
    var items = [];
    keys.forEach(function(name) {
      items.push({
        title: _(name),
        key: name
      });
    });
    this.app.optionMenuController.once('closed', function() {
      if (document.activeElement.getAttribute('id') !==
          'month-view-date-picker' &&
          document.activeElement.getAttribute('id') !==
          'progress-indicator' &&
          currentAction !== 'month-view-calendars-to-display') {
        this._getCurFocus().focus();
      }
    }.bind(this));
    this.app.optionMenuController.once('selected', function(optionKey) {
      currentAction = optionKey;
      switch(optionKey) {
        case 'month-view-current-date':
          this._goToDay('current-day');
          break;
        case 'month-view-go-to-date':
          this.datePicker.value =
            InputParser.exportDate(this.controller.selectedDay);
          this.datePicker.focus();
          break;
        case 'month-view-calendars-to-display':
          if (!this.calendarChooser) {
            this.calendarChooser = new CalendarChooser({ app: this.app });
            this.calendarChooser.event.on('hide', () => {
              document.querySelector('#time-views').classList.remove('cal-chooser-bg');
              this._getCurFocus().focus();
            });
          }
          this.calendarChooser.show();
          document.querySelector('#time-views').classList.add('cal-chooser-bg');
          break;
        case 'month-view-settings':
          router.go('/advanced-settings/');
          break;
        case 'month-view-sync-calendar':
          if (this.app.offline()) {
            this.app.toast.show({message: _('error-offline')});
          } else {
            var progress = document.getElementById('progress-indicator');
            this.app.syncController.once('syncStart', function() {
              progress.focus();
              softkeyHandler.register(progress, {
                lsk: {
                  name: 'cancel',
                  action: () => {
                    this.app.syncController.interrupt();
                    return false;
                  }
                },
                dpe: {},
                rsk: {}
              });
            }.bind(this));
            this.app.syncController.once('syncComplete', function() {
              this._getCurFocus().focus();
            }.bind(this));
            this.app.syncController.all();
          }
          break;
      }
    }.bind(this));
    this.app.optionMenuController.show({
      items: items
    });
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
  },

  _getCurFocus: function() {
    return this.element.querySelector('li.focus');
  },

  changeFocus: function(dstDay) {
    var focused = this.element.querySelectorAll('li.focus');
    for (var i = 0; i < focused.length; i++) {
      focused[i].classList.remove('focus');
    }
    var dayId = Calc.getDayId(dstDay);
    var selector = `section.month.active li[data-date="${dayId}"]`;
    var dstNode = this.element.querySelector(selector);
    dstNode.classList.add('focus');
    dstNode.focus();
  }

};

});
