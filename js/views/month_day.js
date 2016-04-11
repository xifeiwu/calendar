define(function(require, exports, module) {
'use strict';

var Calc = require('calc');
var dayObserver = require('day_observer');
var dateFormat = require('date_format');

// MonthDay represents a single day inside the Month view grid.
function MonthDay(options) {
  this.container = options.container;
  this.date = options.date;
  this.month = options.month;
  this._updateBusyCount = this._updateBusyCount.bind(this);
}
module.exports = MonthDay;

MonthDay.prototype = {

  container: null,
  date: null,
  element: null,
  month: null,
  dayId: null,
  day: null,

  create: function() {
    this.dayId = Calc.getDayId(this.date);
    var id = 'month-view-day-' + this.dayId;
    var state = Calc.relativeState(this.date, this.month);
    var l10nStateId = state.replace(/\s/g, '-');
    var date = this.date.getDate();

    // we don't care about future/past states for l10n unless it's on
    // a different month (Bug 1092729)
    if (l10nStateId === 'future' || l10nStateId === 'past') {
      l10nStateId = '';
    } else {
      l10nStateId += '-description';
    }

    var el = document.createElement('li');
    el.setAttribute('role', 'gridcell');
    el.id = id;
    el.setAttribute('tabindex', 1);
    el.setAttribute(
      'aria-describedby',
      `${id}-busy-indicator ${id}-description`
    );
    el.dataset.date = this.dayId;
    el.className = state;
    el.classList.add('month-day');
    el.classList.add('focusable');
    el.innerHTML =
      `<span class="day" role="button" aria-hidden="true">${date}</span>
      <div id="${id}-busy-indicator" class="busy-indicator"
        aria-hidden="true"></div>
      <span id="${id}-description" aria-hidden="true"
        data-l10n-id="${l10nStateId}"></span>`;

    this.element = el;
    this.container.appendChild(el);
  },

  activate: function() {
    dayObserver.on(this.date, this._updateBusyCount);
  },

  deactivate: function() {
    dayObserver.off(this.date, this._updateBusyCount);
  },

  destroy: function() {
    this.deactivate();
    this.container = this.element = null;
  },

  _updateBusyCount: function(data) {
    this.day = data;
    var count = Math.min(1, data.amount);
    var holder = this.element.querySelector('.busy-indicator');
    if (data.amount === 0) {
      this.element.setAttribute('role','gridcell-no-events');
    } else {
      this.element.setAttribute('role','gridcell');
    }

    this._readOutInfo(data.amount);

    var diff = count - holder.childNodes.length;
    if (diff === 0) {
      return;
    }

    if (diff > 0) {
      var dot;
      while (diff--) {
        dot = document.createElement('div');
        dot.className = 'gaia-icon icon-calendar-dot';
        holder.appendChild(dot);
      }
      return;
    }

    // difference < 0
    while (diff++) {
      holder.removeChild(holder.firstChild);
    }
  },

  _readOutInfo: function(eventNum) {
    var container = this.element.querySelector('.busy-indicator');
    var readOutInfo =
      dateFormat.localeFormat(
        this.date,
        navigator.mozL10n.get('month-view-read-out-info')
      );
    if (eventNum > 0) {
      readOutInfo += ', ' +
        navigator.mozL10n.get('busy', {
          n: eventNum
        });
    } else {
      readOutInfo += ', ' + navigator.mozL10n.get('no-events');
    }
    container.setAttribute('aria-label', readOutInfo);
  },

  getDayId: function() {
    return this.dayId;
  }
};

});
