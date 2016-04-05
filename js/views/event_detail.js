/* global softkeyHandler */
define(function(require, exports, module) {
'use strict';

var EventBase = require('./event_base');
var DurationTime = require('templates/duration_time');
var alarmTemplate = require('templates/alarm');
var router = require('router');
var _ = navigator.mozL10n.get;

require('dom!event-detail-view');

function EventDetail(options) {
  EventBase.apply(this, arguments);
}
module.exports = EventDetail;

EventDetail.prototype = {
  __proto__: EventBase.prototype,

  INVITATION: 'invitation',

  selectors: {
    element: '#event-detail-view',
    header: '#event-detail-header',
    title: '#event-detail-title',
    locationContainer: '#event-detail-view li.location',
    location: '#event-detail-location',
    durationTime: '#event-detail-duration-time',
    currentCalendar: '#event-detail-current-calendar',
    indicator: '#event-detail-view li div .indicator',
    alarms: '#event-detail-alarms',
    description: '#event-detail-description',
    invitationFrom:'#event-detail-invitation-from',
    invitees:'#event-detail-invitees'
  },

  get title() {
    return this._findElement('title');
  },

  get locationContainer() {
    return this._findElement('locationContainer');
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

  get indicator() {
    return this._findElement('indicator');
  },

  _initEvents: function() {
  },

  _resetUI: function() {
    this.title.textContent = '';
    this.location.textContent = '';
    this.locationContainer.style.display = 'none';
    this.invitationFrom.textContent = '';
    this.invitees.innerHTML = '';
    this.durationTime.innerHTML = '';
    this.currentCalendar.textContent = '';
    this.indicator.style.backgroundColor = '';
    this.alarms.innerHTML = '';
    this.description.innerHTML = '';
  },

  /**
   * Updates the UI to use values from the current model.
   */
  _updateUI: function() {
    var model = this.event;
    // TODO: use isRouting the flag is just a workaround to prevent opening
    // dialog while operating router.go. a common solution for this
    // issue(OT-1495) is required. Router.go + dialog softkeys can be
    // also found in setup calendar(online part), will find a method to fix this
    // after online functions are implemented.
    var isRouting = false;
    this.title.textContent = model.title;
    if (model.location) {
      this.locationContainer.style.display = '';
      this.location.textContent = model.location;
    } else {
      this.locationContainer.style.display = 'none';
    }

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

    var durationTimeContent =
      DurationTime.durationTimeEventDetail.render({
        startDate: this.busytime.startDate,
        endDate: this.busytime.endDate,
        isAllDay: model.isAllDay,
        isRecurring: model.isRecurring,
        repeat: model.repeat
      });
    this.durationTime.innerHTML = durationTimeContent;

    this.app.store('Calendar').get(model.calendarId, (err, calendar) => {
      if (err) {
        this.currentCalendar.textContent = '';
      } else {
        this.indicator.style.backgroundColor = calendar.remote.color;
        this.app.store('Account').get(calendar.accountId, (err, account) => {
          if (err) {
            this.currentCalendar.textContent = calendar.remote.name;
          } else {
            this.currentCalendar.textContent = _('account-calendar-format', {
              account: _('preset-' + account.preset),
              calendar: calendar.remote.name
            });
          }
        });
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

    if (document.getElementById('notification-dialog-wrapper').lastChild) {
      document.getElementById('notification-dialog-wrapper').lastChild.focus();
    } else if (this.element.spatialNavigator) {
      this.element.spatialNavigator.focus();
    } else {
      this.element.focus();
    }

    if ((model.remote.attendees && model.remote.attendees.length > 0) ||
        !this.isLocal) {
      softkeyHandler.register(this.element, {
        lsk: {
          name: 'back',
          action: () => {
            router.go('/event/list/' + this.busytimeId);
            return false;
          }
        },
        dpe: {name: ''},
        rsk: {name: ''}
      });
    } else {
      softkeyHandler.register(this.element, {
        lsk: {
          name: 'back',
          action: () => {
            router.go('/event/list/' + this.busytimeId);
            return false;
          }
        },
        dpe: {
          name: 'edit',
          action: () => {
            if (this.busytimeId) {
              isRouting = true;
              router.go('/event/edit/' + this.busytimeId);
            }
          }
        },
        rsk: {
          name: 'delete',
          action: () => {
            if (model.remote.isRecurring) {
              this.optionMenuController.once('closed', () => {
                this.element.focus();
                this.element.spatialNavigator.focus();
              });

              this.optionMenuController.once('selected', (optionKey) => {
                switch(optionKey) {
                  case 'delete-this-only':
                    this.deleteSingleEvent(this.busytimeId, (err, evt) => {});
                    this.optionMenuController.close();
                    router.go('/event/list/');
                    break;
                  case 'delete-all-future':
                    this.deleteFutureEvents(this.busytimeId, (err, evt) => {});
                    this.optionMenuController.close();
                    router.go('/event/list/');
                    break;
                }
              });

              this.optionMenuController.show({
                header: _('repeat-event-header'),
                items: [
                  {
                    title: _('delete-this-only'),
                    key: 'delete-this-only'
                  },
                  {
                    title: _('delete-all-future'),
                    key: 'delete-all-future'
                  }
                ]
              });
            } else {
              if (isRouting) {
                return;
              }
              this.dialogController.once('closed', () => {
                this.element.focus();
                this.element.spatialNavigator.focus();
              });

              this.dialogController.show({
                message: navigator.mozL10n.get('delete-event-confirmation'),
                dialogType: 'confirm',
                softKeysHandler: {
                  lsk: {
                    name: 'cancel',
                    action: () => {
                      this.dialogController.close();
                      return false;
                    }
                  },
                  dpe: {},
                  rsk: {
                    name: 'delete',
                    action: () => {
                      this.dialogController.close();
                      this.deleteEvent(this.busytimeId, (err, evt) => {
                        router.go('/event/list/');
                      });
                      return false;
                    }
                  }
                }
              });
            }
            return false;
          }
        }
      });
    }

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
    this._resetUI();
  }
};

});
