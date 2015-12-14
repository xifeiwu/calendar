define(function(require, exports, module) {
'use strict';

var EventBase = require('./event_base');
var DurationTime = require('templates/duration_time');
var Local = require('provider/local');
var alarmTemplate = require('templates/alarm');
var router = require('router');
var dayObserver = require('day_observer');
var providerFactory = require('provider/provider_factory');
var Event = require('models/event');
require('shared/h5-dialog/dist/amd/script');

require('dom!event-detail-view');

function EventDetail(options) {
  EventBase.apply(this, arguments);
  this.store = this.app.store('Event');
  this.changeToken = 0;
  this.isDialogOpened = false;
}
module.exports = EventDetail;

EventDetail.prototype = {
  __proto__: EventBase.prototype,

  selectors: {
    element: '#event-detail-view',
    header: '#event-detail-header',
    title: '#event-detail-title',
    location: '#event-detail-location',
    durationTime: '#event-detail-duration-time',
    currentCalendar: '#event-detail-current-calendar',
    alarms: '#event-detail-alarms',
    description: '#event-detail-description',
    h5Dialog: '#event-detail-dialog'
  },

  get rootElement() {
    return this._findElement('element');
  },

  get title() {
    return this._findElement('title');
  },

  get location() {
    return this._findElement('location');
  },

  get durationTime() {
    return this._findElement('durationTime');
  },

  get currentCalendar() {
    return this._findElement('currentCalendar');
  },

  get alarms() {
    return this._findElement('alarms');
  },

  get description() {
    return this._findElement('description');
  },

  get h5Dialog() {
    return this._findElement('h5Dialog');
  },

  _initEvents: function() {
    // This method would be called by EventBase.
    this.h5Dialog.on('h5dialog:opened', function() {
      this.isDialogOpened = true;
    }.bind(this));
    this.h5Dialog.on('h5dialog:closed', function() {
      this.h5Dialog.removeAttribute('tabindex');
      this.isDialogOpened = false;
      this.rootElement.focus();
    }.bind(this));
    this.h5Dialog.addEventListener('blur', function(evt) {
      this.h5Dialog.close();
    }.bind(this));
  },

  openConfirmDialog: function() {
    this.h5Dialog.setAttribute('tabindex', '0');
    SoftkeyHandler.register(this.h5Dialog, {
      lsk: {
        name: 'cancel',
        action: () => {
          this.h5Dialog.close();
        }
      },
      dpe: {},
      rsk: {
        name: 'delete',
        action: () => {
          this.h5Dialog.close();
          this.deleteEvent();
        }
      }
    });
    this.h5Dialog.open({
      message: navigator.mozL10n.get('delete-event-confirmation'),
      dialogType: 'confirm'
    });
  },

  /**
   * Updates the UI to use values from the current model.
   */
  _updateUI: function() {
    var model = this.event;
  
    this.title.textContent = model.title;

    this.location.textContent = model.location;

    var dateSrc = model;
    if (model.remote.isRecurring && this.busytime) {
      dateSrc = this.busytime;
    }
    var durationTimeContent =
      DurationTime.durationTimeEventDetail.render(dateSrc);
    this.durationTime.innerHTML = durationTimeContent;

    if (this.originalCalendar) {
      var calendarId = this.originalCalendar.remote.id;
      var isLocalCalendar = calendarId === Local.calendarId;
      var calendarName = isLocalCalendar ?
        navigator.mozL10n.get('calendar-local') :
        this.originalCalendar.remote.name;
        this.currentCalendar.textContent = calendarName;
    } else {
      this.currentCalendar.textContent = '';
    }

    var alarmContent = '';
    var alarms = this.event.alarms;
    if (alarms) {
      alarmContent = alarmTemplate.reminder.render({
        alarms: alarms,
        isAllDay: this.event.isAllDay,
      });
      this.alarms.innerHTML = alarmContent;
    }

    this.description.textContent = model.description;

    this.rootElement.focus();
    this.rootElement.spatialNavigator.focus(location);

    SoftkeyHandler.register(this.rootElement, {
      lsk: {
        name: 'back',
        action: () => {
          this.cancel();
        }
      },
      dpe: {
        name: 'edit',
        action: () => {
          if (this.busytimeId) {
            router.go('/event/edit/' + this.busytimeId);
          }
        }
      },
      rsk: {
        name: 'delete',
        action: () => {
          this.openConfirmDialog();
        }
      }
    });
  },

  deleteEvent: function() {
    var self = this;
    var id = this.busytimeId;
    var token = ++this.changeToken;

    dayObserver.findAssociated(id).then(record => {
      if (token === self.changeToken) {
        var event = new Event(record.event);
        var changeToken = ++self.changeToken;
        self.store.ownersOf(event, function (err, owners) {
          if (err) {
            console.error('fetch Owners ' + err);
            return;
          }
          self.originalCalendar = owners.calendar;
          self.provider = providerFactory.get(owners.account.providerType);
          self.provider.eventCapabilities(event, function (err, caps) {
            if (self.changeToken !== changeToken) {
              console.error('token are not matched.');
              return;
            }
            if (err) {
              console.error('Failed to fetch events capabilities: ' + err);
              return;
            }
            if (caps.canDelete) {
              self.provider.deleteEvent(event.data, function(err) {
                if (err) {
                  console.error('provider.deleteEvent: ' + err);
                } else {
                  console.log('Delete success: ' + JSON.stringify(event.data));
                }
                self.cancel();
              });
            }
          });
        });
      }
    }).catch(() => {
      console.error('Error deleting records for id: ', id);
    });
  },

  /**
   * Sets content for an element
   * Hides the element if there's no content to set
   */
  setContent: function(element, content, method) {
    method = method || 'textContent';
    element = this.getEl(element);
    element.querySelector('.content')[method] = content;

    if (!content) {
      element.style.display = 'none';
    } else {
      element.style.display = '';
    }
  },

  oninactive: function() {
    EventBase.prototype.oninactive.apply(this, arguments);
  }
};

});
