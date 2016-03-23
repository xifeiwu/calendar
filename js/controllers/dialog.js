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
  this.dialogContainer = document.getElementById('calendar-dialog-wrapper');
  this.notiContainer = document.getElementById('notification-dialog-wrapper');
  this.focusedEl = null;
  this.containerZIndex = window.getComputedStyle(this.notiContainer).zIndex;
  this.dialog.dialogTextInput.type = 'text';
  this.dialog.on('h5dialog:opened', function() {
    if (DEBUG) {
      console.log('DialogController opened');
    }
    this.dialogContainer.classList.add('active');
    this.emit('opened');
  }.bind(this));

  this.dialog.on('h5dialog:closed', function() {
    if (DEBUG) {
      console.log('DialogController closed');
    }
    this.dialogContainer.classList.remove('active');
    this.removeAllEventListeners('input-blur');
    this.emit('closed');
  }.bind(this));

  this.dialog.dialogTextInput.addEventListener('keydown', (evt) => {
    if (!this.notiContainer.querySelector('.notifications-dialog')) {
      switch (evt.keyCode) {
        case KeyboardEvent.DOM_VK_RETURN:
          if (DEBUG) {
            console.log('DialogController blur');
          }
          this.emit('input-blur');
          break;
        case KeyboardEvent.DOM_VK_CANCEL:
          this.close();
          break;
        default:
          break;
      }
    }
  });

  Responder.call(this);
}
module.exports = DialogController;

DialogController.prototype = {
  __proto__: Responder.prototype,

  show: function(option) {
    if (DEBUG) {
      console.log(JSON.stringify(option));
    }

    this.dialog.focus();
    if (!option || !option.dialogType) {
      console.warn('DialogController warnning: empty option!');
    }

    if (option.softKeysHandler) {
      softkeyHandler.register(this.dialog, option.softKeysHandler);
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
    notiDialog.style.zIndex = Number(this.containerZIndex) +
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
            focusToView(this.focusedEl);
          } else {
            this.notiContainer.lastChild.focus();
          }
          return false;
        }
      },
      lsk: {
        action: () => {
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

    function focusToView(focusedEl) {
      var pastContainer = focusedEl;
      var viewContainer = ['SECTION', 'H5-OPTION-MENU'];
      if (pastContainer && pastContainer.parentElement) {
        while (viewContainer.indexOf(pastContainer.tagName) < 0) {
          pastContainer = pastContainer.parentElement;
        }
        if (pastContainer.classList.contains('active') ||
            pastContainer.tagName === 'H5-OPTION-MENU') {
          return focusedEl.focus();
        }
      }
      document.querySelector('section.active [tabindex="0"]').focus();
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
