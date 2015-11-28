define(function(require, exports, module) {
'use strict';

var View = require('view');
require('dom!setup-calendar-view');

function SetupCalendar(options) {
  View.apply(this, arguments);
}
module.exports = SetupCalendar;

SetupCalendar.prototype = {
  __proto__: View.prototype,

  selectors: {
    element: '#setup-calendar-view',
    header: '#setup-calendar-header'
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
  },

  oninactive: function() {
    View.prototype.oninactive.call(this);
  }
};

});
