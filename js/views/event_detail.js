/* global SoftkeyHandler */
define(function(require, exports, module) {
'use strict';

var EventBase = require('./event_base');
var DurationTime = require('templates/duration_time');
var alarmTemplate = require('templates/alarm');
var router = require('router');
var dayObserver = require('day_observer');
var _ = navigator.mozL10n.get;

require('dom!event-detail-view');

function EventDetail(options) {
  EventBase.apply(this, arguments);
  this.store = this.app.store('Event');
  this.deleteController = this.app.deleteController;
  this.dialogController = this.app.dialogController;
  this.optionMenuController = this.app.optionMenuController;
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

  get invitationFrom() {
    return this._findElement('invitationFrom');
  },

  get invitees() {
    return this._findElement('invitees');
  },

  _initEvents: function() {
  },

  _openConfirmDialog: function(deleteSingleOnly) {
    var option = {
      message: navigator.mozL10n.get('delete-event-confirmation'),
      dialogType: 'confirm',
      softKeysHandler: {
        lsk: {
          name: 'cancel',
          action: () => {
            this.dialogController.close();
          }
        },
        dpe: {},
        rsk: {
          name: 'delete',
          action: () => {
            this.dialogController.close();
            this.deleteEvent(deleteSingleOnly);
          }
        }
      }
    };

    this.dialogController.once('opened', function() {
    }.bind(this));

    this.dialogController.once('closed', function() {
      this.rootElement.focus();
      this.rootElement.spatialNavigator.focus(location);
    }.bind(this));

    this.dialogController.show(option);
  },

  _showOptionMenu: function(method) {
    if (method !== 'delete' && method !== 'edit') {
      return console.error('method must be delete or edit.');
    }
    if (!this.busytimeId) {
      return console.error('Illegal busytimeId!');
    }

    var items = [
      {
        title: _(method + '-this-only'),
        key: method + '-this-only'
      },
      {
        title: _(method + '-all'),
        key: method + '-all'
      }
    ];

    this.optionMenuController.once('closed', function() {
      this.rootElement.focus();
      this.rootElement.spatialNavigator.focus(location);
    }.bind(this));

    this.optionMenuController.once('selected', function(optionKey) {
      switch(optionKey) {
        case 'delete-this-only':
          this._openConfirmDialog(true);
          break;
        case 'delete-all':
          this._openConfirmDialog(false);
          break;
        case 'edit-this-only':
          router.go('/event/edit/' + this.busytimeId + '/edit-this-only');
          break;
        case 'edit-all':
          router.go('/event/edit/' + this.busytimeId + '/edit-all');
          break;
      }
    }.bind(this));

    this.optionMenuController.show({
      header: _('repeat-event-header'),
      items: items
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
      if (alarms.length !== 0) {
        alarmContent = alarmTemplate.reminder.render({
          alarms: alarms,
          isAllDay: this.event.isAllDay
        });
      } else {
        alarms.push({
          trigger: 'none'
        });
        alarmContent = alarmTemplate.reminder.render({
          alarms: alarms,
          isAllDay: this.event.isAllDay
        });

      }
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
            router.go('/event/list/');
          }
        },
        dpe: {},
        rsk: {}
      });
    } else {
      SoftkeyHandler.register(this.rootElement, {
        lsk: {
          name: 'back',
          action: () => {
            router.go('/event/list/');
          }
        },
        dpe: {
          name: 'edit',
          action: () => {
            if (model.remote.isRecurring) {
              this._showOptionMenu('edit');
            } else {
              router.go('/event/edit/' + this.busytimeId);
            }
          }
        },
        rsk: {
          name: 'delete',
          action: () => {
            if (model.remote.isRecurring) {
              this._showOptionMenu('delete');
            } else {
              this._openConfirmDialog(false);
            }
          }
        }
      });
    }

  },

  /*
   * TODO: this method is the same as in event list, they should be move to
   * a common class.
   */
  deleteEvent: function(deleteSingleOnly) {
    dayObserver.findAssociated(this.busytimeId).then(record => {
      if (deleteSingleOnly && record.event.remote.isRecurring) {
        this.deleteController.deleteLocalBusytime(record.event, this.busytimeId,
          function(err, evt) {
            if (err) {
              console.error('Delete failed: ' + JSON.stringify(evt));
            } else {
              console.error('Delete successfully: ' + JSON.stringify(evt));
            }
            router.go(this.returnTo());
          }.bind(this)
        );
      } else {
        this.deleteController.deleteEvent(record.event, function(err, evt) {
          if (err) {
            console.error('Delete failed: ' + JSON.stringify(evt));
          } else {
            console.error('Delete successfully: ' + JSON.stringify(evt));
          }
          router.go(this.returnTo());
        }.bind(this));
      }
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
