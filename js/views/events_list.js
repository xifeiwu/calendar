/* global SoftkeyHandler */
define(function(require, exports, module) {
'use strict';

var View = require('view');
var dateFormat = require('date_format');
var dayObserver = require('day_observer');
var createDay = require('calc').createDay;
var isAllDay = require('calc').isAllDay;
var template = require('templates/events_list_item');
var router = require('router');
var _ = navigator.mozL10n.get;
require('shared/h5-dialog/dist/amd/script');

require('dom!events-list-view');

function EventsList(options) {
  View.apply(this, arguments);
  this._render = this._render.bind(this);
  this.controller = this.app.timeController;
  this.deleteController = this.app.deleteController;
  this.optionMenuController = this.app.optionMenuController;
  this.store = this.app.store('Event');
  this.busytimeId = null;
  this.recordsCount = 0;
  this.initHeader();
  this.initDialog();
  this._keyDownHandler = this.handleKeyDownEvent.bind(this);

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

  get h5Dialog() {
    return this._findElement('h5Dialog');
  },

  onactive: function() {
    View.prototype.onactive.call(this);
    this.initCurrentDate(this.controller.selectedDay);
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

  /*
   * TODO: this method is the same as in event detail, they should be move to
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

  handleKeyDownEvent: function(evt) {
    switch (evt.key) {
      case 'Enter':
      case 'Accept':
        if (!this.isDialogOpened) {
          var eventElement = document.activeElement;
          if (!!eventElement && eventElement.hasAttribute('busytimeId')) {
            this.busytimeId = eventElement.getAttribute('busytimeId');
            router.go('/event/detail/' + this.busytimeId);
          } else {
            this.busytimeId = null;
          }
        }
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
            element.setAttribute('cacheFocus','');
            this.busytimeId = element.getAttribute('busytimeId');
            this._showOptionMenu();
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

  _showOptionMenu: function() {
    var items = [
      {
        title: _('edit'),
        key: 'edit'
      },
      {
        title: _('delete'),
        key: 'delete'
      }
    ];

    this.optionMenuController.once('closed', function() {
      var dialogStatus = this.h5Dialog.getAttribute('tabindex');
      if (dialogStatus == '0') {
        return;
      }
      this.events.querySelector('li[cacheFocus]').removeAttribute('cacheFocus');
      this.findAndFocus();
    }.bind(this));

    this.optionMenuController.once('selected', function(optionKey) {
      if (!this.busytimeId) {
        return console.error('Illegal busytimeId!');
      }

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
            message: _('delete-event-confirmation'),
            dialogType: 'confirm'
          });
          break;
      }
    }.bind(this));

    this.optionMenuController.show({
      items: items
    });
  },

  _render: function(records) {
    this.recordsCount = records.basic.length;
    this.recordsCount += records.allday.length;
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
