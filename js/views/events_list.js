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

require('dom!events-list-view');

function EventsList(options) {
  View.apply(this, arguments);
  this._render = this._render.bind(this);
  this.controller = this.app.timeController;
  this.deleteController = this.app.deleteController;
  this.optionMenuController = this.app.optionMenuController;
  this.dialogController = this.app.dialogController;
  this.store = this.app.store('Event');
  this.busytimeId = null;
  this.lastFocusedEvent = null;
  this.recordsCount = 0;
  // key => busytimeId, value => event
  this.records = {};
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
    events: '#events-list'
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

  onactive: function() {
    View.prototype.onactive.call(this);
    this.initCurrentDate(this.controller.selectedDay);
    window.addEventListener('keydown', this._keyDownHandler, false);
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
      var events = this.events.querySelectorAll('li');

      if (events && events.length > 0) {
        if (this.lastFocusedEvent &&
            this.events.contains(this.lastFocusedEvent)) {
          this.lastFocusedEvent.focus();
        } else {
          events[0].focus();
        }
      }
    } else {
      router.go('/month/');
    }
  },

  /*
   * TODO: this method is the same as in event detail, they should be move to
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
          }
        );
      } else {
        this.deleteController.deleteEvent(record.event, function(err, evt) {
          if (err) {
            console.error('Delete failed: ' + JSON.stringify(evt));
          } else {
            console.error('Delete successfully: ' + JSON.stringify(evt));
          }
        });
      }
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
        evt.preventDefault();
        break;
      case 'AcaSoftRight':
        if (!this.isDialogOpened) {
          var element = document.activeElement;
          if (!!element && element.hasAttribute('busytimeId')) {
            element.setAttribute('cacheFocus','');
            this.busytimeId = element.getAttribute('busytimeId');
            this.lastFocusedEvent = element;
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
    var textContent = dateFormat.localeFormat(date, _(formatId));
    this.currentDate.textContent = textContent;
    // we need to set the [data-date] and [data-l10n-date-format] because
    // locale might change while the app is still open
    this.currentDate.dataset.date = date;
    this.currentDate.dataset.l10nDateFormat = formatId;
  },

  _showOptionMenu: function() {
    var deleteItem = {
      title: _('delete'),
      key: 'delete'
    };
    if (this.records[this.busytimeId].remote.isRecurring) {
      deleteItem.options = {
        header: _('repeat-event-header'),
        items: [
          {
            title: _('delete-this-only'),
            key: 'delete-this-only'
          },
          {
            title: _('delete-all'),
            key: 'delete-all'
          }
        ]
      };
    }
    var items = [
      {
        title: _('edit'),
        key: 'edit'
      },
      deleteItem
    ];

    this.optionMenuController.once('closed', function() {
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
        case 'delete-all':
          this._showDialog({
            message: _('delete-event-confirmation'),
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
                  this.deleteEvent(false);
                }
              }
            }
          });
          break;
        case 'delete-this-only':
          this._showDialog({
            message: _('delete-event-confirmation'),
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
                  this.deleteEvent(true);
                }
              }
            }
          });
          break;
      }
    }.bind(this));

    this.optionMenuController.show({
      items: items
    });
  },

  _showDialog: function(options) {
    var option = {
      header: options.header,
      message: options.message,
      dialogType: options.dialogType,
      softKeysHandler: options.softKeysHandler
    };

    this.dialogController.once('opened', function() {
      this.isDialogOpened = true;
    }.bind(this));

    this.dialogController.once('closed', function() {
      this.isDialogOpened = false;
      this.findAndFocus();
    }.bind(this));

    this.dialogController.show(option);
  },

  _render: function(records) {
    this.records = {};
    this.recordsCount = records.basic.length + records.allday.length;
    // we should always render allday events at the top
    this.events.innerHTML = records.allday.concat(records.basic)
      .map(this._renderEvent, this)
      .join('');
    this.findAndFocus();
  },

  _renderEvent: function(record) {
    var {event, busytime} = record;
    var {startDate, endDate} = busytime;
    this.records[busytime._id] = event;

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
