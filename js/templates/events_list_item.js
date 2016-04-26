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
    var timeFormat = navigator.mozHour12 ? 'twelve-hour' : 'twenty-four-hour';

    var indicator = `
      <div class="indicator" style="background-color: ${color}">
      </div>`;

    var eventTime;
    if (this.arg('isAllDay')) {
      eventTime = `
        <div class="event-time p-sec" format="${timeFormat}">
          <div class="all-day" data-l10n-id="hour-allday">All Day</div>
        </div>`;
    } else {
      var startTime = formatTimeTo(this.arg('startTime'));
      var endTime = formatTime(this.arg('endTime'));
      eventTime = `
        <div class="event-time p-sec" format="${timeFormat}">
          <div class="start-time">${startTime}</div>
          <div class="end-time">${endTime}</div>
        </div>`;
    }

    var title = this.h('title');
    var arTitle = wordsLayouts(title);
    var eventDetails =`
      <div class="event-details p-pri" dir="auto" role="presentation">
        ${arTitle}
      </div>`;

    var content = `
      <li tabindex="0" busytimeId="${busytimeId}" eventId="${eventId}"
        calendarId="${calendarId}" role="menuitem">
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
    format: 'shortTimeFormat-calendar'
  });
}

function formatTimeTo(time) {
  return DateSpan.time.render({
    time: time,
    format: 'shortTimeFormatTo-calendar'
  });
}

function wordsLayouts (title) {
  var ctx = document.getElementById('calculator').getContext('2d');
  var bodyStyle = window.getComputedStyle(document.body);
  var textArea = document.querySelector('#events-list-view .event-details');
  var allStyles = window.getComputedStyle(textArea);
  var width = parseFloat(allStyles.width);
  width -= parseFloat(allStyles.paddingLeft);
  width -= parseFloat(allStyles.paddingRight);
  ctx.font = allStyles.fontSize + bodyStyle.fontFamily;

  var result = '';
  if (ctx.measureText(title).width < width * 3) {
    result = '<span>' + title + '</span>';
  } else {
    var allStrs = title.split(' ');
    var size = allStrs.length;
    var index = 0;
    var subStr = '';
    while (index <= size) {
      subStr = allStrs.slice(0, index).join(' ');
      if (ctx.measureText(subStr).width > width * 2) {
        break;
      }
      index++;
    }
    var firstPart = allStrs.slice(0, index - 1).join(' ');
    var lastPart = allStrs.slice(index - 1).join(' ');
    // if allStrs[index] is large than width, then it will be splited.
    if (ctx.measureText(firstPart).width <= width) {
      index = 1;
      while (index <= title.length) {
        subStr = title.slice(0, index);
        if (ctx.measureText(subStr).width > width * 2) {
            break;
        }
        index++;
      }
      firstPart = title.slice(0, index - 1);
      lastPart = title.slice(index - 1);
    }
    result += '<span>' + firstPart + '</span>';
    result += '<span class="last">' + lastPart + '</span>';
  }
  return result;
}

});
