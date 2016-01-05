define(function(require, exports, module) {
'use strict';

var DateSpan = require('./date_span');
var create = require('template').create;

var EventsListItem = create({
  event: function() {
    var busytimeId = this.h('busytimeId');
    var eventId = this.h('eventId');
    var calendarId = this.h('calendarId');
    var color = this.h('color');

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
      var startTime = formatTimeTo(this.arg('startTime'));
      var endTime = formatTime(this.arg('endTime'));
      eventTime = `
        <div class="event-time">
          <div class="start-time">${startTime}</div>
          <div class="end-time">${endTime}</div>
        </div>`;
    }

    var title = this.h('title');
    var eventDetails =`
      <div class="event-details" dir="auto" role="presentation">
        ${title}
      </div>`;

    var content = `
      <li tabindex="0" busytimeId="${busytimeId}" eventId="${eventId}"
        calendarId="${calendarId}">
        <div class="event">
          ${indicator} ${eventTime} ${eventDetails}
        </span>
      </li>`;
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

function formatTimeTo(time) {
  return DateSpan.time.render({
    time: time,
    format: 'shortTimeFormatTo'
  });
}

});
