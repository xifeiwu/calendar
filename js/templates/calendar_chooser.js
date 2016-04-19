define(function(require, exports, module) {
'use strict';

var Local = require('provider/local');
var create = require('template').create;

module.exports = create({
  calendar: function() {
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
      <li role="menuitem">
        <div class="on-off-line-calendar">
          <div class="indicator"
            style="background-color: ${color} !important;"></div>
          <label>
            <p ${l10n}>${name}</p>
          </label>
          <h5-checkbox value="${id}" ${checked}></h5-checkbox>
        </div>
      </li>`;
  },

  account: function() {
    var id = this.s('_id');
    var name = this.s('preset');;
    var upperCaseName = name.toUpperCase();
    var localesName = 'preset-' + name;
    return `
      <div account-id=${id}>
        <h5-separator data-l10n-id=${localesName}>
          ${upperCaseName}</h5-separator>
        <ul>
        </ul>
      </div>`;
  }
});

});
