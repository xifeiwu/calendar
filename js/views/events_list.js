define(function(require, exports, module) {
'use strict';

var EventBase = require('./event_base');
var dateFormat = require('date_format');
var dayObserver = require('day_observer');
var createDay = require('calc').createDay;
var isAllDay = require('calc').isAllDay;
var template = require('templates/events_list_item');
var router = require('router');
var _ = navigator.mozL10n.get;

require('dom!events-list-view');

function EventsList(options) {
  EventBase.apply(this, arguments);
  this._render = this._render.bind(this);
  this.controller = this.app.timeController;
  this.deleteController = this.app.deleteController;
  this.optionMenuController = this.app.optionMenuController;
  this.dialogController = this.app.dialogController;
  this.store = this.app.store('Event');
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
  __proto__: EventBase.prototype,

  selectors: {
    element: '#events-list-view',
    header: '#events-list-header',
    currentDate: '#events-list-header-date',
    events: '#events-list-view #events-list'
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
    EventBase.prototype.onactive.apply(this, arguments);
    this.initCurrentDate(this.controller.selectedDay);
    window.addEventListener('keydown', this._keyDownHandler, false);
  },

  oninactive: function() {
    EventBase.prototype.oninactive.apply(this, arguments);
    if (this.date) {
      dayObserver.off(this.date, this._render);
    }
    this.date = null;
    window.removeEventListener('keydown', this._keyDownHandler);
  },

  _initEvents: function() {
  },

  findAndFocus: function() {
    var busytimes = this.events.querySelectorAll('li[busytimeid]');
    if (busytimes.length) {
      var toFocus = null;
      for (var i = 0; i < busytimes.length; i++) {
        if (busytimes[i].getAttribute('busytimeid') === this.busytimeId) {
          toFocus = busytimes[i];
          break;
        }
      }
      if (toFocus) {
        toFocus.focus();
      } else {
        busytimes[0].focus();
      }
    } else {
      router.go('/month/');
    }
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
            // XXX: only support options for local events for now
            if (element.getAttribute('providerType') === 'Local') {
              element.setAttribute('cacheFocus','');
              this.busytimeId = element.getAttribute('busytimeId');
              this._showOptionMenu();
            }
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
    this.findAndFocus();
  },

  _showOptionMenu: function() {
    var deleteItem = {
      title: _('delete'),
      key: 'delete'
    };
    var editItem = {
      title: _('edit'),
      key: 'edit'
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

      editItem.options = {
        header: _('repeat-event-header'),
        items: [
          {
            title: _('edit-this-only'),
            key: 'edit-this-only'
          },
          {
            title: _('edit-all'),
            key: 'edit-all'
          }
        ]
      };
    }
    var items = [
      editItem,
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
        case 'edit-this-only':
          router.go('/event/edit/' + this.busytimeId + '/edit-this-only');
          break;
        case 'edit-all':
          router.go('/event/edit/' + this.busytimeId + '/edit-all');
          break;
        case 'delete':
          this._showDialog({
            message: _('delete-event-confirmation'),
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
                  this.deleteEvent(true, this.busytimeId,
                    function(err, evt) {}
                  );
                  return false;
                }
              }
            }
          });
          break;
        case 'delete-all':
          this.deleteEvent(false, this.busytimeId, function(err, evt) {});
          break;
        case 'delete-this-only':
          this.deleteEvent(true, this.busytimeId, function(err, evt) {});
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

    // Re-order the list, lift the first added event (and earliest) on the top
    records.basic = records.basic.sort(stampSorts);
    records.basic = records.basic.sort(startTimeSorts);

    // Applies the same method to all-day event
    records.allday = records.allday.sort(stampSorts);

    // Order the list according to timeStamps
    function stampSorts(a, b) {
      var obA = a.event.remote.timeStamp;
      var obB = b.event.remote.timeStamp;
      obA = !!(obA && obB) ? obA : (obB || obA || '');
      obB = !!(obA && obB) ? obB : (obA || obB || '');
      return obA - obB;
    }

    // Order the list according to time sequences
    function startTimeSorts(a, b) {
      return a.event.remote.start.utc - b.event.remote.start.utc;
    }

    // we should always render allday events at the top
    this.events.innerHTML = records.allday.concat(records.basic)
      .map(this._renderEvent, this)
      .join('');
    this.findAndFocus();

    var fetchOwners = function(ele) {
      return new Promise((resolve, reject) => {
        this.store.ownersOf(ele.getAttribute('calendarId'),
          function (err, owners) {
            if (err) {
              return console.error('fetch owners error: ' + err);
            }
            ele.setAttribute('providerType', owners.account.providerType);
            // XXX: hide options for non-local events for now
            if (owners.account.providerType === 'Local') {
              ele.classList.add('sk-events-list-item');
            } else {
              ele.classList.add('sk-events-list-item-online');
              // since online events don't have color field, so use
              // the calendar's color which the event belongs to
              ele.querySelector('div.indicator').style.backgroundColor =
                owners.calendar.remote.color;
            }
          });
        resolve();
      });
    }.bind(this);

    var promises = [];
    var elements = this.events.querySelectorAll('li');
    for (var i = 0; i < elements.length; i++) {
      promises.push(fetchOwners(elements[i]));
    }

    Promise.all(promises).then(() => {
      console.log('Finish updating all events.');
    });
  },

  _renderEvent: function(record) {
    var {event, busytime} = record;
    var {startDate, endDate} = busytime;
    this.records[busytime._id] = event;

    return template.event.render({
      eventId: event._id,
      calendarId: event.calendarId,
      busytimeId: busytime._id,
      title: event.remote.title,
      color: event.remote.color,
      startTime: startDate,
      endTime: endDate,
      isAllDay: isAllDay(this.date, startDate, endDate)
    });
  },

  ondispatch: function(params) {
    this.busytimeId = params.busytimeId;
  }
};

});
