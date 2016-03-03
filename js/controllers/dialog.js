/* global softkeyHandler */
define(function(require, exports, module) {
'use strict';

var Responder = require('responder');
var nextTick = require('next_tick');
require('shared/h5-dialog/dist/amd/script');

var DEBUG = false;

function DialogController(app) {
  this.app = app;
  this.dialog = document.getElementById('calendar-dialog');
  this.notiContainer = document.getElementById('notification-dialog-wrapper');
  this.focusedEl = null;
  this.containerZIndex = window.getComputedStyle(this.notiContainer).zIndex;

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

  this.dialog.dialogTextInput.addEventListener('blur', function(evt) {
    if (DEBUG) {
      console.log('DialogController blur');
    }
    if (!this.notiContainer.querySelector('.notifications-dialog')) {
      this.emit('input-blur');
    }
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

  notiCreate: function(option) {
    if (DEBUG) {
      console.log(JSON.stringify(option));
    }

    var notiDialog = new H5Dialog();
    notiDialog.setAttribute('tabindex','0');
    notiDialog.style.zIndex = this.containerZIndex +
      this.notiContainer.childNodes.length;
    notiDialog.classList.add('notifications-dialog');
    if (!this.notiContainer.lastChild) {
      this.focusedEl = document.activeElement;
      if (this.focusedEl.tagName === 'INPUT' &&
        this.focusedEl.parentElement.tagName === 'H5-INPUT-WRAPPER') {
        this.focusedEl = this.focusedEl.parentElement;
      }
    }

    this.notiContainer.appendChild(notiDialog);

    var softKeysHandler = {
      rsk: {
        name: 'ok',
        action: () => {
          this.notiContainer.lastChild.close();
          this.notiContainer.lastChild.remove();
          if (!this.notiContainer.lastChild) {
            this.focusedEl.focus();
          } else {
            this.notiContainer.lastChild.focus();
          }
          return false;
        }
      }
    };
    softkeyHandler.register(this.notiContainer.lastChild, softKeysHandler);

    notiDialog.open({
      header: option.header || '',
      dialogType: option.dialogType || 'prompt',
      message: option.message || '',
      initialValue: option.initialValue || ''
    });
    nextTick(() => {
      // Force notiDialog to be focused here is helpful when the dialog is
      // pop-up while user is turning into another page
      this.notiContainer.lastChild.focus();
    });
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
  },
};

});
