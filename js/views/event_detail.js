/* global SoftkeyHandler */
define(function(require, exports, module) {
'use strict';

var EventBase = require('./event_base');
var DurationTime = require('templates/duration_time');
var Local = require('provider/local');
var alarmTemplate = require('templates/alarm');
var router = require('router');
var dayObserver = require('day_observer');
require('shared/h5-dialog/dist/amd/script');

require('dom!event-detail-view');

function EventDetail(options) {
  EventBase.apply(this, arguments);
  this.store = this.app.store('Event');
  this.deleteController = this.app.deleteController;
  this.isDialogOpened = false;
}
module.exports = EventDetail;

EventDetail.prototype = {
  __proto__: EventBase.prototype,

  INVITATION: 'invitation',

  selectors: {
    element: '#event-detail-view',
    header: '#event-detail-header',
    title: '#event-detail-title',
    location: '#event-detail-location',
    durationTime: '#event-detail-duration-time',
    currentCalendar: '#event-detail-current-calendar',
    alarms: '#event-detail-alarms',
    description: '#event-detail-description',
    h5Dialog: '#event-detail-dialog',
    invitationFrom:'#event-detail-invitation-from',
    invitees:'#event-detail-invitees'
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

  get invitationFrom() {
    return this._findElement('invitationFrom');
  },

  get invitees() {
    return this._findElement('invitees');
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

    if (model.remote.attendees && model.remote.attendees.length > 0) {
      var organizer = model.remote.organizer;
      organizer = organizer.replace('mailto:','');
      this.invitationFrom.textContent = organizer;
      var attendeesStr = '';
      for (var attendee in model.remote.attendees) {
        var attedeeMail = model.remote.attendees[attendee];
        attedeeMail = attedeeMail.replace('mailto:','');
        attendeesStr += attedeeMail;
        attendeesStr += '<br >';
      }
      this.invitees.innerHTML = attendeesStr;
      this.element.classList.remove(this.INVITATION);
    } else {
      this.element.classList.add(this.INVITATION);
    }

    var dateSrc = model;
    if (model.remote.isRecurring && this.busytime) {
      dateSrc = this.busytime;
    }
    var durationTimeContent =
      DurationTime.durationTimeEventDetail.render(dateSrc);
    this.durationTime.innerHTML = durationTimeContent;

    this.app.store('Calendar').get(model.calendarId, (err, calendar) => {
      if (err) {
        this.currentCalendar.textContent = '';
      } else {
        this.currentCalendar.textContent = calendar.remote.name;
      }
    });

    var alarmContent = '';
    var alarms = this.event.alarms;
    if (alarms) {
      alarmContent = alarmTemplate.reminder.render({
        alarms: alarms,
        isAllDay: this.event.isAllDay,
      });
      this.alarms.innerHTML = alarmContent;
    }

    this.description.innerHTML = model.description;

    this.rootElement.focus();
    this.rootElement.spatialNavigator.focus(location);

    if (model.remote.attendees && model.remote.attendees.length > 0) {
      SoftkeyHandler.register(this.rootElement, {
      lsk: {
        name: 'back',
        action: () => {
          this.cancel();
        }
      },
      dpe: {
        name: '',
        action: () => {
          
        }
      },
      rsk: {
        name: '',
        action: () => {
          
        }
      }
    });
    } else {
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
    }

  },

  /*
   * TODO: this method is the same as in event list, they should be move to
   * a common class.
   */
  deleteEvent: function() {
    dayObserver.findAssociated(this.busytimeId).then(record => {
      this.deleteController.deleteEvent(record.event, function(err, evt) {
        if (err) {
          console.error('Delete failed: ' + JSON.stringify(evt));
        } else {
          console.error('Delete successfully: ' + JSON.stringify(evt));
        }
      });
    }).catch(() => {
      console.error('Error deleting records for id: ', this.busytimeId);
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
