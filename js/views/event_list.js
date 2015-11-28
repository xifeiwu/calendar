define(function(require, exports, module) {
'use strict';

var View = require('view');
require('dom!event-list-view');

function EventList(options) {
  View.apply(this, arguments);
}
module.exports = EventList;

EventList.prototype = {
  __proto__: View.prototype,

  selectors: {
    element: '#event-list-view',
    header: '#event-list-header'
  },
};

});
