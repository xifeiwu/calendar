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
    var arTitle = wordsLayouts(title);
    var eventDetails =`
      <div class="event-details" dir="auto" role="presentation">
        ${arTitle}
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

function wordsLayouts (title) {
  // To build a connection between strings' width and number of strings, a
  // canvas was implemented and worked as a calculator.
  var c = document.getElementById('calculator');
  var ctx = c.getContext('2d');
  var theFontFamily =
    window.getComputedStyle(document.body).getPropertyValue('font-family');
  var detailDiv =
    document.querySelector('#events-list-view #detailDiv');
  var detailDivStyle = window.getComputedStyle(detailDiv);
  var fontSize = detailDivStyle.getPropertyValue('font-size');
  var containerWidth = parseFloat(detailDivStyle.getPropertyValue('width'));
  containerWidth -=
    parseFloat(detailDivStyle.getPropertyValue('padding-left'));
  containerWidth -=
    parseFloat(detailDivStyle.getPropertyValue('padding-right'));
  // Since words have different widths, 90% percent of total width to prevent
  // incorrect display.
  containerWidth *= 0.9;
  ctx.font = fontSize + theFontFamily;
  // The requirement is to display 3 lines, change this lineNumber's value
  // if other numbers are on demand in the future.
  var lineNumber = 3;
  if (Math.ceil(ctx.measureText(title).width) < containerWidth * lineNumber) {
    return title;
  }
  // The widest string 'W' is used as a standard to define at where we start to
  // add strings one by one until strings reaches the boundary.
  var stringsLimitation =
    Math.floor((containerWidth * lineNumber)/ctx.measureText('W').width);
  var arr = title.slice(0, stringsLimitation);
  while (Math.ceil(ctx.measureText(arr).width) < containerWidth * lineNumber) {
    arr += title.slice(stringsLimitation, stringsLimitation + 1);
    stringsLimitation++;
  }
  arr += '...';
  return arr;
}

});
