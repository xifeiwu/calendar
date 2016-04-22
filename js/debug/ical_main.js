define(function(require, exports, module) {
'use strict';

var ICAL = require('ext/ical');
var Calc = require('calc');
var providerFactory = require('provider/provider_factory');
var CaldavPullEvents = require('provider/caldav_pull_events');
var ICALString = require('./ical_string')

function DebugICAL(forDebug) {
  this.forDebug = forDebug;
  this.debug = this.forDebug.debug;

  if (this.forDebug.app) {
    this.app = this.forDebug.app;
    this.service = this.app.serviceController;
    this.accountStore = this.app.store('Account');
    this.calendarStore = this.app.store('Calendar');
    this.busytimeStore = this.app.store('Busytime');
    this.eventStore = this.app.store('Event');
    this.icalComponentStore = this.app.store('IcalComponent');
  } else {
    this.debug('this.forDebug.app does not found.');
  }
}
module.exports = DebugICAL;

DebugICAL.prototype = {
  expandToGlobal: function() {
    // this.forDebug.ICAL = ICAL;
  },

  /*
   * CreateEvent is used to create a new (recurring) event using necessary data.
   * @param {boolean} recurring whether it is a recurring event
   * @param {string} uuid the uuid of the event
   */
  testCreateEvent: function(recurring, uuid, callback) {
    if (!callback) {
     callback = function() {};
    }
    var self = this;
    var event = {
      'remote': {
        'start': {
          'utc': 1451610000000,
          'offset': -36000000
        },
        'startDate': '2016-01-01T11:00:00.000Z',
        'end': {
          'utc': 1451613600000,
          'offset': -36000000
        },
        'endDate': '2016-01-01T12:00:00.000Z',
        'title': 'Title',
        'location': '',
        'isRecurring': false,
        'repeat': 'never',
        'description': '',
        'recurrenceId': '',
        'timeStamp': 1451778112227,
        'alarms': [],
        'color': '#6115BF',
        'id': '1352d3d9-4bb0-4267-b5bc-6d5014954896'
      },
      'calendarId': 'local-first',
      '_id': 'local-first-1352d3d9-4bb0-4267-b5bc-6d5014954896'
    };
    if (recurring) {
      event.remote.isRecurring = true;
      event.remote.repeat = recurring;
    }
    if (uuid) {
      event.remote.id = uuid;
      event._id = event.calendarId + '-' + uuid;
    }
    var localProvider = providerFactory.get('Local');
    function normalEventCb(err, busytimes, events) {
      callback(err, busytimes, events);
    }
    function recurringEventCb(err, events, components, busytimes) {
      if (err) {
        this.debug('create fail' + err);
      }
      this.debug('create success');
      // components[1].ical is not very correct.
      // This is caused by the logic of caldav_pull_event
      this.debug(components[1].ical);
      this.showIcalStructure(components[1].ical);
    }
    if (recurring) {
      localProvider.createEvent(event, recurringEventCb.bind(this));
    } else {
      localProvider.createEvent(event, normalEventCb.bind(this));
    }
  },

  /**
   * get local accout and first local calendar
   */
  getLocalInfo: function(callback) {
    return new Promise((resolve, reject) => {
      var record = {};
      var localAccount = null;
      var localCalendar = null;
      this.accountStore.all().then((accounts) => {
        for (var key in accounts) {
          if (accounts[key].providerType === 'Local') {
            localAccount = accounts[key];
            break;
          }
        }
        if (localAccount) {
          var trans = this.app.db.transaction('calendars', 'readonly');
          var calendarStore = trans.objectStore('calendars'); 
          var indexedStore = calendarStore.index('accountId');
          var keyRange = window.IDBKeyRange.only(localAccount._id);
          var req = indexedStore.openCursor(keyRange);
          req.onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
              localCalendar = cursor.value;
              record.account = localAccount;
              record.calendar = localCalendar;
              resolve(record);
            }
          };
        }
      });
    });
  },

  /**
   * create event and busytimes using iCalendar String given.
   */
  processIcalComponent: function(owners, iCalString, callback) {
    // The parameter repeat shoule be passed by event.
    // But no event here, so set 'every-week' as default.
    var monthSpan = Calc.spanOfTwoMonth(this.app.timeController.month);
    var stream = this.service.stream(
      'caldav',
      'streamEventsFromLocal',
      owners.account.toJSON(),
      owners.calendar.remote,
      {
        ical: iCalString,
        span: monthSpan.toJSON(),
        repeat: 'every-week',
        color: '#FF0000'
      }
    );

    var pull = new CaldavPullEvents(stream, {
      app: this.app,
      account: owners.account,
      calendar: owners.calendar
    });

    stream.request((err) => {
      if (err) {
        return callback(err);
      }
      pull.commit((commitErr, events, components, busytimes) => {
        if (commitErr) {
          callback(err);
        } else {
          callback(null, events, components, busytimes);
        }
      });
    });
  },

  /**
   * This is the main function for showing
   * how to create Event and Busytimes using iCalendar String given.
   */
  expandIcalString: function(iCalString) {
    if (!iCalString) {
      iCalString = ICALString.googleIcalString;
    }
    console.log('The iCalString to expand: ' + iCalString);
    console.log('The Object format of iCalString: ');
    console.log(ICAL.Component.fromString(iCalString));
    this.getLocalInfo().then((owners) => {
      this.processIcalComponent(owners, iCalString, 
        (err, events, components, busytimes) => {
          if (err) {
            this.debug('processIcalComponent fail: ' + err);
            return;
          }
          this.debug('expandIcalString success.');
          this.debug('the number of events:' + events.length);
          // Notice: two component are returned
          this.debug('the number of components:' + components.length);
          this.debug('the number of busytimes:' + busytimes.length);
          console.log(components[0].ical);
        });
    })
    .catch(() => {
      this.debug('something is erro when expandIcalString.');
    });
  },

};

});
