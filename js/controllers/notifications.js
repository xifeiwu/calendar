define(function(require, exports) {
'use strict';

var calc = require('calc');
var dateFormat = require('date_format');
var debug = require('debug')('controllers/notifications');
var messageHandler = require('message_handler');
var notification = require('notification');
var nextTick = require('next_tick');

// Will be injected...
exports.app = null;

exports.observe = function() {
  debug('Will start notifications controller...');
  messageHandler.responder.on('alarm', exports.onAlarm);
};

exports.unobserve = function() {
  messageHandler.responder.off('alarm', exports.onAlarm);
};

exports.onAlarm = function(alarm) {
  debug('Will request cpu wake lock...');
  var lock = navigator.requestWakeLock('cpu');
  this.dialogController = exports.app.dialogController;
  debug('Received cpu lock. Will issue notification...');
  if (document.hidden) {
    return issueNotification(alarm).catch(err => {
      console.error('controllers/notifications', err.toString());
    }).then(() => {
      // release cpu lock with or without errors
      debug('Will release cpu wake lock...');
      lock.unlock();
    });
  }

  issueNotification(alarm).then(value => {
    var title = value.title;
    var body = value.body;
    var focusedEl = null;
    var option = null;
    option = {
      header: title,
      message: body,
      dialogType: 'confirm',
      softKeysHandler: {
        rsk: {
          name: 'ok',
          action: () => {
            this.dialogController.notiClose();
            nextTick(() => {
              focusedEl.focus();
            });
            return false;
          }
        }
      }
    };
    nextTick(() => {
      // Force notiDialog to be focused here is helpful when the dialog is
      // pop-up while user is turning into another page
      focusedEl = document.activeElement;
      if(focusedEl.tagName === 'INPUT' &&
        focusedEl.parentElement.tagName === 'H5-INPUT-WRAPPER') {
        focusedEl = focusedEl.parentElement;
      }
      this.dialogController.notiDialog.focus();
      this.dialogController.notiShow(option);
    });
  });
};

function issueNotification(alarm) {
  var app = exports.app;
  var eventStore = app.store('Event');
  var busytimeStore = app.store('Busytime');

  var trans = app.db.transaction(['busytimes', 'events']);

  // Find the event and busytime associated with this alarm.
  return Promise.all([
    eventStore.get(alarm.eventId, trans),
    busytimeStore.get(alarm.busytimeId, trans)
  ])
  .then(values => {
    var [event, busytime] = values;

    // just a safeguard on the very unlikely case that busytime or event
    // doesn't exist anymore (should be really hard to happen)
    if (!event) {
      throw new Error(`can't find event with ID: ${alarm.eventId}`);
    }
    if (!busytime) {
      throw new Error(`can't find busytime with ID: ${alarm.busytimeId}`);
    }

    var begins = calc.dateFromTransport(busytime.start);
    var distance = dateFormat.fromNow(begins);
    var now = new Date();

    var alarmType = begins > now ?
      'alarm-start-notice-time' :
      'alarm-started-notice-time';

    var l10n = navigator.mozL10n;
    var title = l10n.get('alarm-start-notice-title', {
      title: event.remote.title
    });
    var body = l10n.get(alarmType, {
      distance: distance
    });

    debug('Will send event notification with title:', title, 'body:', body);
    if(document.hidden) {
      return notification.sendNotification(
        title,
        body,
        `/alarm-display/${busytime._id}`
      );
    } else {
      return {'title': title, 'body': body};
    }
  });
}

});
