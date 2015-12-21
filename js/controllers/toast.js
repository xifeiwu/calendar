define(function(require, exports, module) {
'use strict';

function Toast() {
  this.toastStatus = document.getElementById('calendar-toast');
  this.toastContent = this.toastStatus.querySelector('.message');
  this.hide = this.hide.bind(this);
  this.toastVisible = false;
}
module.exports = Toast;

Toast.ACTIVE = 'active';

Toast.prototype = {
  show: function(option) {
    this.toastContent.textContent = option.message;
    this.toastVisible = true;
    this.toastStatus.classList.add(Toast.ACTIVE);
    this.toastStatus.addEventListener('animationend', this.hide);
  },

  hide: function() {
    this.toastStatus.classList.remove(Toast.ACTIVE);
    this.toastStatus.removeEventListener('animationend', this.hide);
    this.toastVisible = false;
  }
};

});
