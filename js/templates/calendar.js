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

    // localize only the default calendar; there is no need to set the name
    // the [data-l10n-id] will take care of setting the proper value
    if (id && Local.calendarId === id) {
      // localize the default calendar name
      l10n = 'data-l10n-id="calendar-local"';
    } else {
      name = this.h('name');
    }

    var checked = this.bool('localDisplayed', 'checked');
    var ariaSelected = this.bool('localDisplayed', 'aria-selected="true"');

    return `<li id="calendar-${id}" role="presentation">
        <div class="gaia-icon icon-calendar-dot" style="color:${color}"
             aria-hidden="true"></div>
        <label class="pack-checkbox" role="option" ${ariaSelected}>
          <input value="${id}" type="checkbox" ${checked}/>
          <span ${l10n} class="name" dir="auto">${name}</span>
        </label>
      </li>`;
  },

  calendarLi: function() {
    var id = this.s('id');
    var name = this.s('name');
    var color = this.s('color');
    var timeStamp = this.s('timeStamp');
    return `
      <li role="presentation" tabindex="0" calendar-id=${id}
        time-stamp=${timeStamp}>
        <div class="on-off-line-calendar">
          <div class="indicator"
            style="background-color: ${color} !important;"></div>
            <div class="setup-calendar-id">
              <p class="setup-calendar-p">${name}</p>
            </div>
          </div>
      </li>`;
  },
});

});
