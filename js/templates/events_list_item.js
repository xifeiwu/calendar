define(function(require, exports, module) {
'use strict';

var DateSpan = require('./date_span');
var create = require('template').create;
var colors = [
  '#1c6dea', '#463add', '#7c2deb', '#b925d9', '#becb1d',
  '#00919c', '#00ba65', '#00d7bb', '#ae0188', '#d91b57',
  '#ff3140'
];

var EventsListItem = create({
  event: function() {
    var busytimeId = this.h('busytimeId');

    var color = colors[Math.floor(Math.random() * 10)];
    var indicator = `
      <div class="indicator" style="background-color: ${color}">
      </div>`;

    var eventTime;
    if (this.arg('isAllDay')) {
      eventTime = `
        <div class="event-time">
          <div class="all-day" data-l10n-id="hour-allday">All Day</div>
        </div>`;
    } else {
      var startTime = formatTime(this.arg('startTime'));
      var endTime = formatTime(this.arg('endTime'));
      eventTime = `
        <div class="event-time">
          <div class="start-time">${startTime}</div>
          <div class="end-time">${endTime}</div>
        </div>`;
    }

    var title = this.h('title');
    var eventDetails =`
      <div class="event-details" dir="auto">
        <h5 role="presentation">${title}</h5>
      </div>`;

    var content = `<ul><li tabindex="0" nav-scope>
      <a href="/event/show/${busytimeId}/" class="event sk-events-list-item"
      role="option" aria-describedby="${busytimeId}-icon-calendar-alarm">
      ${indicator}
      ${eventTime}
      ${eventDetails}
      </a></li></ul>`;
    return content;
  }
});
module.exports = EventsListItem;

function formatTime(time) {
  return DateSpan.time.render({
    time: time,
    format: 'shortTimeFormat'
  });
}

});
