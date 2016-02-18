define(function(require, exports, module) {
'use strict';

var Responder = require('responder');
require('shared/h5-option-menu/dist/amd/script');

function OptionMenuController(app) {
  this.app = app;

  this.optionMenu = document.getElementById('calendar-option-menu');

  Responder.call(this);
}
module.exports = OptionMenuController;

OptionMenuController.prototype = {
  __proto__: Responder.prototype,

  show: function(option) {
    if (!option || !option.items) {
      return console.error('OptionMenuController error: empty option!');
    }

    this.optionMenu.setOptions({
      header: option.header || '',
      items: option.items
    });

    this.optionMenu.on('h5options:closed', function() {
      this.removeAllEventListeners('selected');
      // The following translate will be set to half height of a will-be-opened
      // option menu, in this case, resetting this translate to 0 is required
      // since we try to open a option-menu of a different height
      this.optionMenu.querySelector('.inner-container').style.transform =
        'translateY(0%)';
      this.emit('closed');
    }.bind(this));

    this.optionMenu.on('h5options:opened', function() {
      this.emit('opened');
    }.bind(this));

    this.optionMenu.on('h5options:selected', function(e) {
      var optionKey = e.detail.key;
      this.emit('selected', optionKey);
    }.bind(this));

    this.emit('preopen');
    this.optionMenu.open();
  },

  close: function(option) {
    this.emit('preclose');
    this.optionMenu.close();
  },

  back: function(option) {
    this.emit('back');
    this.optionMenu.back();
  }
};

});
