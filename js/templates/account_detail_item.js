define(function(require, exports, module) {
'use strict';

var create = require('template').create;

var AccountDetailItem = create({
  item: function() {
    var calendarId = this.h('calendarId');
    var name = this.h('name');
    var color = this.h('color');

    var content = `
      <li role="presentation" tabindex="0" calendar-id=${calendarId}>
        <div class="calendar-container">
          <div class="indicator"
            style="background-color: ${color} !important;"></div>
            <div class="calendar-name-container">
              <p class="calendar-name">${name}</p>
            </div>
          </div>
      </li>`;
    return content;
  }
});
module.exports = AccountDetailItem;

});
