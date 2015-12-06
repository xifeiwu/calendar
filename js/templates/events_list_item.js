define(function(require, exports, module) {
'use strict';

var DateSpan = require('./date_span');
var create = require('template').create;
var colors = [
  '#6115BF', '#7515BF', '#9115BF', '#A115BF', '#154DBF',
  '#1531BF', '#2515BF', '#3D15BF', '#12CBC4', '#12A2CB',
  '#1585BF', '#1579BF', '#2CCB12', '#12CB46', '#12CB7A',
  '#12CBA6', '#D6CF1B', '#B9D713', '#94D713', '#66D713'
];

var EventsListItem = create({
  event: function() {
    var busytimeId = this.h('busytimeId');

    var color = colors[Math.floor(Math.random() * 20)];
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
          <div class="start-time">${startTime}-</div>
          <div class="end-time">${endTime}</div>
        </div>`;
    }

    var title = this.h('title');
    var eventDetails =`
      <div class="event-details" dir="auto">
        <h5 role="presentation">${title}</h5>
      </div>`;

    var content = `
      <li tabindex="0" class="sk-events-list-item" busytimeId="${busytimeId}">
        <span class="event">
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

});
