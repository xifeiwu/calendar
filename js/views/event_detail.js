define(function(require, exports, module) {
'use strict';

var View = require('view');
require('dom!event-detail-view');

function EventDetail(options) {
  View.apply(this, arguments);
}
module.exports = EventDetail;

EventDetail.prototype = {
  __proto__: View.prototype,

  selectors: {
    element: '#event-detail-view',
    header: '#event-detail-header'
  },
};

});
