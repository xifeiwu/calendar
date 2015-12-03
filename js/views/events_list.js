define(function(require, exports, module) {
'use strict';

var View = require('view');
var providerFactory = require('provider/provider_factory');
var Event = require('models/event');
var dateFormat = require('date_format');
var dayObserver = require('day_observer');
var createDay = require('calc').createDay;
var isAllDay = require('calc').isAllDay;
var template = require('templates/events_list_item');
var router = require('router');
require('shared/h5-option-menu/dist/amd/script');
require('shared/h5-dialog/dist/amd/script');

require('dom!events-list-view');

function EventsList(options) {
  View.apply(this, arguments);
  this._render = this._render.bind(this);
  this.controller = this.app.timeController;
  this.store = this.app.store('Event');
  this.busytimeId = null;
  this.recordsCount = 0;
  this.changeToken = 0;

  // TODO:
  // After closing h5dialog by soft key(lsk or rsk), the focus should be
  // transferted to events. But soft keys helper did not stop the event and
  // this page still can receive the keydown event. So the option menu
  // will open again. A workaround is that to modify soft keys helper while
  // it is calling "window.addEventListener('keydown', handleEvent);"
  // and pass true as this method's third parameter. Another solution is
  // that to use a flag to save the opening status of dialog and check this
  // flag while handling key down event.
  this.isDialogOpened = false;
}
module.exports = EventsList;

EventsList.prototype = {
  __proto__: View.prototype,

  selectors: {
    element: '#events-list-view',
    header: '#events-list-header',
    currentDate: '#events-list-header-date',
    events: '#events-list',
    optionMenu: '#events-list-option-menu',
    h5Dialog: '#events-list-dialog'
  },

  get rootElement() {
    return this._findElement('element');
  },

  get currentDate() {
    return this._findElement('currentDate');
  },

  get events() {
    return this._findElement('events');
  },

  get optionMenu() {
    return this._findElement('optionMenu');
  },

  get h5Dialog() {
    return this._findElement('h5Dialog');
  },

  onactive: function() {
    View.prototype.onactive.call(this);
    this.initCurrentDate(this.controller.selectedDay);
    this.initHeader();
    this.initOptionMenu();
    this.initDialog();
    this._keyDownHandler = this.handleKeyDownEvent.bind(this);
    window.addEventListener('keydown', this._keyDownHandler, false);
  },

  initHeader: function() {
    SoftkeyHandler.register(this.currentDate, {
      lsk: {
        name: 'back',
        action: () => {
          router.go('/month/');
        }
      }
    });
  },

  initOptionMenu: function() {
    this.optionMenu.setOptions({
      items: [
        {
          title: navigator.mozL10n.get('edit'),
          key: 'edit'
        },
        {
          title: navigator.mozL10n.get('delete'),
          key: 'delete'
        }
      ]
    });

    this.optionMenu.on('h5options:closed', function() {
      this.optionMenu.removeAttribute('tabindex');
    }.bind(this));

    this.optionMenu.on('h5options:opened', function() {
    }.bind(this));

    this.optionMenu.on('h5options:selected', function(e) {
      if (!this.busytimeId) {
        console.error('Illegal busytimeId!');
        return;
      }
      var optionKey = e.detail.key;
      switch(optionKey) {
        case 'edit':
          router.go('/event/edit/' + this.busytimeId);
          break;
        case 'delete':
          this.h5Dialog.setAttribute('tabindex', '0');
          SoftkeyHandler.register(this.h5Dialog, {
            lsk: {
              name: 'cancel',
              action: () => {
                this.h5Dialog.close();
              }
            },
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
          break;
      }
    }.bind(this));
  },

  initDialog: function() {
    this.h5Dialog.on('h5dialog:opened', function() {
      this.isDialogOpened = true;
    }.bind(this));
    this.h5Dialog.on('h5dialog:closed', function() {
      this.h5Dialog.removeAttribute('tabindex');
      this.findAndFocus();
      this.isDialogOpened = false;
    }.bind(this));
    this.h5Dialog.addEventListener('blur', function(evt) {
      this.h5Dialog.close();
    }.bind(this));
  },

  oninactive: function() {
    View.prototype.oninactive.call(this);
    if (this.date) {
      dayObserver.off(this.date, this._render);
    }
    this.date = null;
    window.removeEventListener('keydown', this._keyDownHandler);
  },

  findAndFocus: function() {
    this.rootElement.focus();
    if (this.recordsCount > 0) {
      this.currentDate.removeAttribute('tabindex');
      var events = this.events.querySelectorAll('li');
      if (events && events.length > 0) {
        var firstEvent = events[0];
        firstEvent.focus();
      }
    } else {
      this.currentDate.setAttribute('tabindex', '0');
      this.currentDate.focus();
    }
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
                  return;
                }
                console.log('Delete success: ' + JSON.stringify(event.data));
              });
            }
          });
        });
      }
    }).catch(() => {
      console.error('Error deleting records for id: ', id);
    });
  },

  handleKeyDownEvent: function(evt) {
    switch (evt.key) {
      case 'Enter':
      case 'Accept':
        // TODO: navi to /event/detail/{id}
        break;
      case 'AcaSoftLeft':
        if (!this.isDialogOpened) {
          router.go('/month/');
        }
        break;
      case 'AcaSoftRight':
        if (!this.isDialogOpened) {
          var element = document.activeElement;
          if (!!element && element.hasAttribute('busytimeId')) {
            this.busytimeId = element.getAttribute('busytimeId');
            this.optionMenu.setAttribute('tabindex', '0');
            this.optionMenu.open();
          } else {
            this.busytimeId = null;
          }
        }
        break;
    }
  },

  initCurrentDate: function(date) {
    date = date || createDay(new Date());
    if (this.date) {
      dayObserver.off(this.date, this._render);
    }
    this.date = date;
    dayObserver.on(this.date, this._render);

    var formatId = 'events-list-header-format';
    var textContent = dateFormat.localeFormat(
      date,
      navigator.mozL10n.get(formatId)
    );
    this.currentDate.textContent = textContent;
    // we need to set the [data-date] and [data-l10n-date-format] because
    // locale might change while the app is still open
    this.currentDate.dataset.date = date;
    this.currentDate.dataset.l10nDateFormat = formatId;
  },

  _render: function(records) {
    this.recordsCount = records.basic.length;
    // we should always render allday events at the top
    this.events.innerHTML = records.allday.concat(records.basic)
      .map(this._renderEvent, this)
      .join('');
    this.findAndFocus();
  },

  _renderEvent: function(record) {
    var {event, busytime} = record;
    var {startDate, endDate} = busytime;

    return template.event.render({
      busytimeId: busytime._id,
      title: event.remote.title,
      startTime: startDate,
      endTime: endDate,
      isAllDay: isAllDay(this.date, startDate, endDate)
    });
  }
};

});
