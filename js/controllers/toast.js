define(function(require, exports, module) {
'use strict';

function Toast() {
  this.toastContent = document.getElementById('calendar-toast-message');
}
module.exports = Toast;

Toast.ACTIVE = 'active';

Toast.prototype = {
  show: function(option) {
    this.toastContent.textContent = option.message;
    if (!option.timeout) {
      option.timeout = 3000;
    }
    this.toastContent.timeout = option.timeout;
    this.toastContent.show();
  }
};

});
