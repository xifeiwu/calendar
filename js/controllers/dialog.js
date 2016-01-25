/* global softkeyHandler */
define(function(require, exports, module) {
'use strict';

var Responder = require('responder');
require('shared/h5-dialog/dist/amd/script');

var DEBUG = false;

function DialogController(app) {
  this.app = app;
  this.dialog = document.getElementById('calendar-dialog');

  this.dialog.on('h5dialog:opened', function() {
    if (DEBUG) {
      console.log('DialogController opened');
    }
    this.emit('opened');
  }.bind(this));

  this.dialog.on('h5dialog:closed', function() {
    if (DEBUG) {
      console.log('DialogController closed');
    }
    this.removeAllEventListeners('input-blur');
    this.emit('closed');
  }.bind(this));

  this.dialog.addEventListener('blur', function(evt) {
    if (DEBUG) {
      console.log('DialogController blur');
    }
    if (this.dialog.classList.contains('opened')) {
      this.dialog.close();
    }
    this.emit('blur');
  }.bind(this));

  this.dialog.dialogTextInput.addEventListener('blur', function(evt) {
    if (DEBUG) {
      console.log('DialogController blur');
    }
    this.emit('input-blur');
  }.bind(this));

  Responder.call(this);
}
module.exports = DialogController;

DialogController.prototype = {
  __proto__: Responder.prototype,

  show: function(option) {
    if (DEBUG) {
      console.log(JSON.stringify(option));
    }

    if (!option || !option.dialogType ||
        !(option.softKeysHandler || option.inputSoftKeysHandler)) {
      console.warn('DialogController warnning: empty option!');
    }

    if (option.softKeysHandler) {
      softkeyHandler.register(this.dialog, option.softKeysHandler);
    }
    if (option.inputSoftKeysHandler) {
      softkeyHandler.register(this.dialog.dialogTextInput,
        option.inputSoftKeysHandler);
    }

    this.dialog.open({
      header: option.header || '',
      dialogType: option.dialogType || 'prompt',
      message: option.message || '',
      initialValue: option.initialValue || ''
    });
    if (DEBUG) {
      console.log('DialogController call open');
    }
  },

  setInputValue: function(text) {
    this.dialog.dialogTextInput.value = text;
  },

  getInputValue: function() {
    return this.dialog.dialogTextInput.value;
  },

  setMessage: function(message) {
    this.dialog.dialogMessage.textContent = message;
  },

  clearMessage: function() {
    this.dialog.dialogMessage.textContent = '';
  },

  close: function(option) {
    if (DEBUG) {
      console.log('DialogController call close');
    }
    this.dialog.close();
  }
};

});
