define(function(require, exports, module) {
'use strict';

var AccessibilityHelper =
  require('shared/accessibility_helper/accessibility_helper');
var Calc = require('calc');
var DateL10n = require('date_l10n');
var Db = require('db');
var ErrorController = require('controllers/error');
var PendingManager = require('pending_manager');
var RecurringEventsController = require('controllers/recurring_events');
var OptionMenuController = require('controllers/option_menu');
var DialogController = require('controllers/dialog');
var DBListener = require('store/listener');
var Toast = require('controllers/toast');
var router = require('router');
var ServiceController = require('controllers/service');
var SyncController = require('controllers/sync');
var TimeController = require('controllers/time');
var Views = {};
var dayObserver = require('day_observer');
var debug = require('debug')('app');
var messageHandler = require('message_handler');
var nextTick = require('next_tick');
var notificationsController = require('controllers/notifications');
var periodicSyncController = require('controllers/periodic_sync');
var performance = require('performance');
var providerFactory = require('provider/provider_factory');
var snakeCase = require('snake_case');
var NavigationManager =
  require('shared/navigation_manager/navigation_manager');
var TextStyle = require('text_style');

var pendingClass = 'pending-operation';

/**
 * Focal point for state management
 * within calendar application.
 *
 * Contains tools for routing and central
 * location to reference database.
 */
module.exports = {
  startingURL: window.location.href,
  _syncTodayDateTimer: null,

  /**
   * Entry point for application
   * must be called at least once before
   * using other methods.
   */
  configure: function(db) {
    debug('Configure calendar with db.');
    this.db = db;
    router.app = this;

    providerFactory.app = this;

    this._views = Object.create(null);
    this._routeViewFn = Object.create(null);
    this._pendingManager = new PendingManager();

    this.loadedLazyStyles = false;

    this._pendingManager.oncomplete = function onpending() {
      document.body.classList.remove(pendingClass);
      performance.pendingReady();
      // start loading sub-views as soon as possible
      if (!this.loadedLazyStyles) {
        this.loadedLazyStyles = true;

        // XXX: not loading the 'lazy_loaded.js' here anymore because for some
        // weird reason curl.js was returning an object instead of
        // a constructor when loading the "views/view_event" when starting the
        // app from a notification; might be related to the fact we bundled
        // multiple modules into the same file, are using the "paths" config to
        // set the location and also using the async require in 2 places and
        // using different module ids for each call.. the important thing is
        // that this should still give a good performance result and works as
        // expected.

        // we need to grab the global `require` because the async require is
        // not part of the AMD spec and is not implemented by all loaders
        window.require(['css!lazy_loaded']);
      }
    };

    this._pendingManager.onpending = function oncomplete() {
      document.body.classList.add(pendingClass);
    };

    messageHandler.app = this;
    messageHandler.start();
    this.timeController = new TimeController(this);
    this.syncController = new SyncController(this);
    this.serviceController = new ServiceController(this);
    this.errorController = new ErrorController(this);
    notificationsController.app = this;
    periodicSyncController.app = this;

    dayObserver.busytimeStore = this.store('Busytime');
    dayObserver.calendarStore = this.store('Calendar');
    dayObserver.eventStore = this.store('Event');
    dayObserver.syncController = this.syncController;
    dayObserver.timeController = this.timeController;

    // observe sync events
    this.observePendingObject(this.syncController);

    // Tell audio channel manager that we want to adjust the notification
    // channel if the user press the volumeup/volumedown buttons in Calendar.
    if (navigator.mozAudioChannelManager) {
      navigator.mozAudioChannelManager.volumeControlChannel = 'notification';
    }
  },

  /**
   * Observes localized events and localizes elements
   * with data-l10n-date-format should be registered
   * after the first localized event.
   *
   *
   * Example:
   *
   *
   *    <span
   *      data-date="Wed Jan 09 2013 19:25:38 GMT+0100 (CET)"
   *      data-l10n-date-format="%x">
   *
   *      2013/9/19
   *
   *    </span>
   *
   */
  observeDateLocalization: function() {
    window.addEventListener('localized', DateL10n.localizeElements);
    window.addEventListener('timeformatchange', () => {
      this.setCurrentTimeFormat();
      DateL10n.changeElementsHourFormat();
      // If users are in event-list page while changing the format, whole page
      // is required to be reloaded since events' list are drew at the beginning
      // of loading this page and changing the time format may reset the width.
      if (router.currentPath.startsWith('/event/list/')) {
        router.go(router.currentPath);
      }
    });
  },

  setCurrentTimeFormat: function() {
    document.body.dataset.timeFormat = navigator.mozHour12 ? '12' : '24';
  },

  /**
   * Adds observers to objects capable of being pending.
   *
   * Object must emit some kind of start/complete events
   * and have the following properties:
   *
   *  - startEvent (used to register an observer)
   *  - endEvent ( ditto )
   *  - pending
   *
   * @param {Object} object to observe.
   */
  observePendingObject: function(object) {
    this._pendingManager.register(object);
  },

  isPending: function() {
    return this._pendingManager.isPending();
  },

  /**
   * To check the ability of modification to online account
   * TODO: For now, we just disable this feature since these
   * functions are not ready.
   */
  isOnlineModificationEnable: function() {
    return false;
  },

  /**
   * Internally restarts the application.
   */
  forceRestart: function() {
    debug('Will restart calendar app.');
    window.location.href = this.startingURL;
  },

  _routes: function() {

    /* routes */
    router.state('/week/', 'Week');
    router.state('/day/', 'Day');
    router.state('/month/', ['Month', 'MonthDayAgenda']);
    router.state('/advanced-settings/', 'AdvancedSettings');
    router.state('/setup-calendar/', 'SetupCalendar');

    router.state('/alarm-display/:id', 'EventDetail', { path: false });

    router.state('/event/add/', 'ModifyEvent');
    router.state('/event/edit/:id', 'ModifyEvent');
    router.state('/event/list/', 'EventsList');
    router.state('/event/list/:busytimeId', 'EventsList');
    router.state('/event/detail/:id', 'EventDetail');
    router.modifier('/account/detail/:id', 'AccountDetail');

    router.modifier('/select-preset/', 'CreateAccount');
    router.modifier('/create-account/:preset', 'ModifyAccount');
    router.modifier('/update-account/:id', 'ModifyAccount');

    router.start();

    // at this point the tabs should be interactive and the router ready to
    // handle the path changes (meaning the user can start interacting with
    // the app)
    performance.chromeInteractive();

    var pathname = window.location.pathname;
    // default view
    if (pathname === '/index.html' || pathname === '/') {
      router.go('/month/');
    }

  },

  _initControllers: function() {
    // controllers can only be initialized after db.load

    // start the workers
    this.serviceController.start(false);

    notificationsController.observe();
    periodicSyncController.observe();

    var recurringEventsController = new RecurringEventsController(this);
    recurringEventsController.observe();
    this.recurringEventsController = recurringEventsController;

    this.optionMenuController = new OptionMenuController(this);
    this.toast = new Toast(this);

    this.dialogController = new DialogController(this);
  },

  _initUI: function() {
    // quick hack for today button
    var tablist = document.querySelector('#view-selector');
    var today = tablist.querySelector('.today a');
    var tabs = tablist.querySelectorAll('[role="tab"]');
    this.lightHouseDate = new Date();

    this._showTodayDate();
    this._syncTodayDate();
    today.addEventListener('click', (e) => {
      var date = new Date();
      this.timeController.move(date);
      this.timeController.selectedDay = date;

      e.preventDefault();
    });

    // Handle aria-selected attribute for tabs.
    tablist.addEventListener('click', (event) => {
      if (event.target !== today) {
        AccessibilityHelper.setAriaSelected(event.target, tabs);
      }
    });

    this.setCurrentTimeFormat();
    // re-localize dates on screen
    this.observeDateLocalization();

    var now = new Date();
    this.timeController.move(now);
    this.timeController.selectedDay = now;
    this.timeController.presentDay = now;

    this.view('TimeHeader', (header) => header.render());

    document.body.classList.remove('loading');

    // at this point we remove the .loading class and user will see the main
    // app frame
    performance.domLoaded();

    this._routes();

    nextTick(() => this.view('Errors'));
    TextStyle.start();
    // Restart the calendar when the timezone changes.
    // We do this on a timer because this event may fire
    // many times. Refreshing the url of the calendar frequently
    // can result in crashes so we attempt to do this only after
    // the user has completed their selection.
    window.addEventListener('moztimechange', () => {
      var date = new Date();
      if (date.getTimezoneOffset() !== this.timezoneOffset) {
        debug('Noticed timezone change!');
        nextTick(this.forceRestart);
      } else {
        // The max number of months stored in the DOM is 3, thus there exists
        // a situation that users are viewing a month that is more than 3 months
        // away from the month-view which contains .present, the lightHouseDate
        // can help to navigate back to a date closer to .present.
        if (!document.querySelector('.present')) {
          this.timeController.move(this.lightHouseDate);
        }
        var arr = document.querySelector('.present').dataset.date.split("-");
        var previousDate = new Date();
        previousDate.setFullYear(arr[1]);
        previousDate.setMonth(arr[2]);
        previousDate.setDate(1);
        var dayInMonth = document.
          querySelector(`section[data-date=${Calc.getDayId(previousDate)}]`);
        previousDate.setDate(arr[3]);
        var days = document.querySelectorAll(`li.${Calc.PRESENT}`);
        Array.prototype.slice.call(days).forEach(day => {
          day.classList.remove(Calc.PRESENT);
        });
        var state = Calc.relativeState(previousDate, date);
        var spacePosition = state.indexOf(' ');
        if (spacePosition > 0) {
          Array.prototype.slice.call(days).forEach(day => {
            day.classList.add(state.slice(0, spacePosition));
            if (day.parentElement.parentElement !== dayInMonth) {
              day.classList.add(state.slice(spacePosition + 1));
            }
          });
        } else {
          Array.prototype.slice.call(days).forEach(day => {
            day.classList.add(state);
          });
        }
        this.lightHouseDate = date;
        // presentDay should be set before function move.
        this.timeController.presentDay = date;
        this.timeController.move(date);
        this.timeController.selectedDay = date;
        this._syncTodayDate(true);
      }
    });
  },

  _setPresentDate: function() {
    var now = new Date();
    var id = Calc.getDayId(now);
    var presentDate = document.querySelector(
      '#month-view [data-date="' + id + '"]'
    );
    var previousDate = document.querySelector('#month-view .present');

    previousDate.classList.remove('present');
    previousDate.classList.add('past');
    presentDate.classList.add('present');
    this.timeController.presentDay = now;
    this.timeController.move(now);
  },

  _showTodayDate: function() {
    var element = document.querySelector('#today .icon-calendar-today');
    element.innerHTML = new Date().getDate();
  },

  _syncTodayDate: function(reset) {
    var now = new Date();
    var midnight = new Date(
      now.getFullYear(), now.getMonth(), now.getDate() + 1,
      0, 0, 0
    );
    if (reset && (this._syncTodayDateTimer !== null) ) {
      clearTimeout(this._syncTodayDateTimer);
      this._syncTodayDateTimer = null;
    }

    var timeout = midnight.getTime() - now.getTime();
    this._syncTodayDateTimer = setTimeout(() => {
      this._syncTodayDateTimer = null;
      this._showTodayDate();
      this._setPresentDate();
      this._syncTodayDate();
    }, timeout);
  },

  /**
   * Adjust scroll offset in order to display entire element on screen. If the
   * element is too small like h5-switch, we needs to scroll based on its'
   * parent element
   */
  adjustScroll: function as_adjustScroll(newFocusElem) {

    var elem = newFocusElem;
    var stopElements = ['BODY', 'SECTION', 'H5-TABS-VIEW'];
    if (!elem.hasAttribute('nav-scope')) {
      while (elem && elem.tagName !== 'LI') {
        elem = elem.parentElement;
      }
      elem = elem || newFocusElem;
      var viewContainer = elem;
      if (!viewContainer.parentElement) {
        return;
      }
      while (stopElements.indexOf(viewContainer.parentElement.tagName) < 0) {
        viewContainer = viewContainer.parentElement;
      }

      var rect = elem.getBoundingClientRect();
      var containerRect = viewContainer.getBoundingClientRect();
      var DISTANCE = 5;
      // Height of a separator
      var SEP_HEIGHT = 30;

      // When elements cannot be shown completely due to the viewport height,
      // following codes help to scroll the container element up/downwards.
      if (rect.top < containerRect.top + SEP_HEIGHT) {
        // 30 padding for separator
        viewContainer.scrollTop -= (containerRect.top - rect.top + SEP_HEIGHT);
      } else if (rect.bottom > containerRect.bottom -
                 Math.ceil(containerRect.height/DISTANCE)) {
        // For some cases the difference between rect.bottom
        // and containerRect.bottom are too small to distinguish,
        // thus containerRect.height/DISTANCE is introduced.
        viewContainer.scrollTop += (rect.bottom - containerRect.bottom);
      }

      setTimeout(function() {
        // XXX: Focus an element would introduce auto-scroll
        if (document.activeElement !== newFocusElem) {
          return;
        }
        var rect = elem.getBoundingClientRect();
        var containerRect = viewContainer.getBoundingClientRect();
        var DISTANCE = 5;
        if (rect.top < containerRect.top + SEP_HEIGHT) {
          viewContainer.scrollTop -=
            (containerRect.top - rect.top + SEP_HEIGHT);
        } else if (rect.bottom > containerRect.bottom -
                   Math.ceil(containerRect.height/DISTANCE)) {
          viewContainer.scrollTop += (rect.bottom - containerRect.bottom);
        }
      });
    }
    newFocusElem.focus();
  },

  /**
   * Primary code for app can go here.
   */
  init: function() {
    debug('Will initialize calendar app...');

    this.forceRestart = this.forceRestart.bind(this);
    this.timezoneOffset = new Date().getTimezoneOffset();

    if (!this.db) {
      this.configure(new Db('b2g-calendar', this));
    }

    this.db.load(() => {
      this._initNavigation();
      this._initControllers();
      // it should only start listening for month change after we have the
      // calendars data, otherwise we might display events from calendars that
      // are not visible. this also makes sure we load the calendars as soon as
      // possible
      this.store('Calendar').all(() => dayObserver.init());
      this.dbListener = new DBListener(this);

      // we init the UI after the db.load to increase perceived performance
      // (will feel like busytimes are displayed faster)
      navigator.mozL10n.once(() => this._initUI());

      // To make sure lazy_loaded can be loaded
      if (!this.loadedLazyStyles) {
        this.loadedLazyStyles = true;
        window.require(['css!lazy_loaded']);
      }
    });
  },

  _initNavigation: function() {
    this.keyNavigation = new NavigationManager(null, {
      defaultStrict: true,
      defaultDirection: {
        up: true,
        right: false,
        down: true,
        left: false
      }
    });
    this.keyNavigation.on('focus', this.adjustScroll.bind(this));
  },

  _initView: function(name) {
    var view = new Views[name]({ app: this });
    this._views[name] = view;
  },

  /**
   * Initializes a view and stores
   * a internal reference so when
   * view is called a second
   * time the same view is used.
   *
   * Makes an asynchronous call to
   * load the script if we do not
   * have the view cached.
   *
   *    // for example if you have
   *    // a calendar view Foo
   *
   *    Calendar.Views.Foo = Klass;
   *
   *    app.view('Foo', function(view) {
   *      (view instanceof Calendar.Views.Foo) === true
   *    });
   *
   * @param {String} name view name.
   * @param {Function} view loaded callback.
   */
  view: function(name, cb) {
    if (name in this._views) {
      debug('Found view named ', name);
      var view = this._views[name];
      return cb && nextTick(() => cb.call(this, view));
    }

    if (name in Views) {
      debug('Must initialize view', name);
      this._initView(name);
      return this.view(name, cb);
    }

    var snake = snakeCase(name);
    debug('Will try to load view', name);
    // we need to grab the global `require` because the async require is not
    // part of the AMD spec and is not implemented by all loaders
    window.require([ 'views/' + snake ], (aView) => {
      debug('Loaded view', name);
      Views[name] = aView;
      return this.view(name, cb);
    });
  },

  /**
   * Pure convenience function for
   * referencing a object store.
   *
   * @param {String} name store name. (e.g events).
   * @return {Calendar.Store.Abstact} store.
   */
  store: function(name) {
    return this.db.getStore(name);
  },

  /**
   * Returns the offline status.
   */
  offline: function() {
    return (navigator && 'onLine' in navigator) ? !navigator.onLine : true;
  }
};

});
