define(function(require, exports, module) {
'use strict';

var Local = require('provider/local');
var create = require('template').create;

module.exports = create({
  item: function() {
    var id = this.h('_id');
    var color = this.h('color');
    var l10n = '';
    var name = '';
    var checked = this.bool('localDisplayed', 'checked');

    // localize only the default calendar; there is no need to set the name
    // the [data-l10n-id] will take care of setting the proper value
    if (id && Local.calendarId === id) {
      // localize the default calendar name
      l10n = `data-l10n-id="calendar-local"`;
    } else {
      name = this.h('name');
    }

    return `
      <li role="presentation">
        <div class="on-off-line-calendar">
          <div class="indicator"
            style="background-color: ${color} !important;"></div>
          <div>
            <label ${l10n}>${name}</label>
            <h5-checkbox value="${id}" ${checked}></h5-checkbox>
          </div>
        </div>
      </li>`;
  }
});

});
