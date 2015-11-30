define(function(require, exports, module) {
'use strict';

var View = require('view');
var dateFormat = require('date_format');
var dayObserver = require('day_observer');
var createDay = require('calc').createDay;
var isAllDay = require('calc').isAllDay;
var template = require('templates/events_list_item');
var router = require('router');
var H5OptionMenu = require('shared/h5-option-menu/dist/amd/script');

require('dom!events-list-view');

function EventsList(options) {
  View.apply(this, arguments);
  this._render = this._render.bind(this);
  this.controller = this.app.timeController;
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
    this._keyDownHandler = this.handleKeyDownEvent.bind(this);
    window.addEventListener('keydown', this._keyDownHandler, false);
    this.rootElement.focus();

    this.optionMenu = new H5OptionMenu();
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
      this.rootElement.focus();
    }.bind(this));

    this.optionMenu.on('h5options:opened', function() {
    }.bind(this));

    this.optionMenu.on('h5options:selected', function(e) {
      var optionKey = e.detail.key;
      switch(optionKey) {
        case 'edit':
          break;
        case 'delete':
          break;
      }
    }.bind(this));

    this.rootElement.appendChild(this.optionMenu);
  },

  oninactive: function() {
    View.prototype.oninactive.call(this);
    if (this.date) {
      dayObserver.off(this.date, this._render);
    }
    this.date = null;
    window.removeEventListener('keydown', this._keyDownHandler);
    this.rootElement.removeChild(this.optionMenu);
  },

  handleKeyDownEvent: function(evt) {
    switch (evt.key) {
      case 'Enter':
      case 'Accept':
        // TODO: navi to /event/detail/{id}
        break;
      case 'AcaSoftLeft':
        router.go('/month/');
        break;
      case 'AcaSoftRight':
        // TODO: open option menu
        this.optionMenu.open();
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
    // we should always render allday events at the top
    this.events.innerHTML = records.allday.concat(records.basic)
      .map(this._renderEvent, this)
      .join('');
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
