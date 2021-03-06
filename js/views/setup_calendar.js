/* global softkeyHandler */
define(function(require, exports, module) {
'use strict';

var View = require('view');
var providerFactory = require('provider/provider_factory');
var router = require('router');
var template = require('templates/account');
var calendarTemplate = require('templates/calendar');
var Local = require('provider/local');
var nextTick = require('next_tick');
var _ = navigator.mozL10n.get;
require('dom!setup-calendar-view');

var ACCOUNT_PREFIX = 'account-';
const NAME_IS_BLANK = 1;
const NAME_HAS_EXIST = 2;

function SetupCalendar(options) {
  View.apply(this, arguments);
  this.optionMenuController = this.app.optionMenuController;
  this._initEvents();
  this.initHeader();
  this.dialogController = this.app.dialogController;

  this.dbListener = this.app.dbListener;
  this.allCalendars = this.dbListener.getLocalCalendars();
  this._updateLocalCalendarDOM();
  this.dbListener.on('local-calendar-change', (calendars) => {
    this.allCalendars = calendars;
    this._updateLocalCalendarDOM();
  });

  this._keyDownHandler = this.handleKeyDownEvent.bind(this);
  this._dialogInputHandler = this._handleDialogInputEvent.bind(this);
}
module.exports = SetupCalendar;

SetupCalendar.prototype = {
  __proto__: View.prototype,

  _currentDialogAction: '',
  _currentCalendar: null,
  _nameState: null,

  selectors: {
    element: '#setup-calendar-view',
    header: '#header-setup-calendar',
    accountList: '#setup-calendar-view .account-list',
    createAccount: '#setup-calendar-view .sk-add-account',
    addLocalCalendar: '#setup-calendar-view .add-local-calendar',
    localCalendars: '#setup-calendar-view .local-calendars',
    onlineContainer: '#setup-calendar-view #calendar-online-container'
  },

  get createAccount() {
    return this._findElement('createAccount');
  },

  get accountList() {
    return this._findElement('accountList');
  },

  get addLocalCalendar() {
    return this._findElement('addLocalCalendar');
  },

  get localCalendars() {
    return this._findElement('localCalendars');
  },

  _formatModel: function(model) {
    // XXX: Here for l10n
    return {
      id: model._id,
      preset: model.preset,
      user: model.user,
      hasError: !!model.error
    };
  },

  _displayAccount: function(account) {
    var provider = providerFactory.get(account.providerType);
    return provider.hasAccountSettings;
  },

  _initEvents: function() {
    var account = this.app.store('Account');
    account.on('add', this._addAccount.bind(this));
    account.on('update', this._updateAccount.bind(this));
    account.on('preRemove', this._removeAccount.bind(this));
    account.on('remove', this._removeAccount.bind(this));

    softkeyHandler.register(this.addLocalCalendar, {
      lsk: {
        name: 'back',
        action: () => {
          this._goToAdvancedSettings();
          return false;
        }
      },
      dpe: {
        name: 'select',
        action: () => {
          this._popUpDialog('add');
          return false;
        }
      }
    });

    if (!this.app.isOnlineModificationEnable()) {
      this._findElement('onlineContainer').style.display = 'none';
    }
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    window.addEventListener('keydown', this._keyDownHandler, false);
    this.dialogController.dialog.dialogTextInput.addEventListener('keyup',
      this._dialogInputHandler);
    this.element.focus();
  },

  oninactive: function() {
    View.prototype.oninactive.call(this);
    window.removeEventListener('keydown', this._keyDownHandler);
    this.dialogController.dialog.dialogTextInput.removeEventListener('keyup',
      this._dialogInputHandler);
  },

  _goToAdvancedSettings: function() {
    // TODO: Identifying status of the dialog to determine the lsk behaviour
    // is just a workaround since the page turns even the dialog is focused at
    // the very beginning of showing a prompt type dialog.
    if (this.dialogController.dialog.classList.contains('closed')) {
      router.go('/advanced-settings/');
    }
  },

  handleKeyDownEvent: function(evt) {
    switch (evt.key) {
      case 'Enter':
        break;
      case 'Accept':
        break;
      case 'AcaSoftLeft':
        evt.stopPropagation();
        evt.preventDefault();
        break;
      case 'AcaSoftRight':
        break;
      }
  },

  _handleDialogInputEvent: function(evt) {
    if (this._nameState) {
      var inputValue = this.dialogController.getInputValue().trim();
      var state = this._checkNameValidation(inputValue);
      if (!state) {
        this.dialogController.clearMessage();
      } else {
        switch (this._nameState.errorCode) {
          case NAME_IS_BLANK:
            if (state.errorCode !== NAME_IS_BLANK) {
              this.dialogController.clearMessage();
              this._nameState = null;
            }
            break;
          case NAME_HAS_EXIST:
            if (state.errorCode !== NAME_HAS_EXIST) {
              this.dialogController.clearMessage();
              this._nameState = null;
            }
            break;
        }
      }
    }
  },

  _popUpDialog: function(action, element) {
    this._currentDialogAction = action;
    this._currentCalendar = element;
    var name = '';
    var option = null;
    switch (action) {
      case 'add':
        option = {
          header: _('new-calendar'),
          dialogType: 'prompt'
        };
        this._openDialog(option);
        break;
      case 'delete':
        name = element.querySelector('.setup-calendar-p').innerHTML;
        option = {
          message: _('confirm-delete-calendar', {
            name: name
          }),
          dialogType: 'confirm',
          softKeysHandler: {
            lsk: {
              name: 'cancel',
              action: () => {
                this.dialogController.close();
                return false;
              }
            },
            rsk: {
              name: 'delete',
              action: () => {
                if (this._currentDialogAction &&
                    this._currentDialogAction === 'delete') {
                  this._deleteCalendar();
                  this._currentDialogAction = '';
                }
                this.dialogController.close();
                return false;
              }
            }
          }
        };
        this._openDialog(option);
        break;
      case 'rename':
        name = element.querySelector('.setup-calendar-p').innerHTML;
        option = {
          header: _('rename-calendar'),
          dialogType: 'prompt',
          initialValue: name
        };
        this._openDialog(option);
        break;
    }
  },

  _openDialog: function(option) {
    this.dialogController.once('opened', () => {
      if (option.dialogType === 'prompt') {
        var diaInput = this.dialogController.dialog.dialogTextInput;
        var pos = diaInput.value.length;
        this.dialogController.dialog.dialogMessage.
          setAttribute('role', 'status');
        diaInput.setSelectionRange(pos, pos);
        // TODO: The following setTimeout is just a workaround for readout,
        // when read out is enabled, opening a prompt dialog may set focus to
        // html. Have tried using a promise but didn't work. Maybe this is a
        // issue related to gecko.
        setTimeout(() => {
          diaInput.focus();
        });
      }
    });
    this.dialogController.once('closed', () => {
      this.dialogController.clearMessage();
      this.dialogController.dialog.dialogMessage.removeAttribute('role');
      this.element.focus();
    });
    this.dialogController.once('input-blur', this.dealAction.bind(this));
    this.dialogController.show(option);
  },

  dealAction: function() {
    var content = this.dialogController.getInputValue().trim();
    switch(this._currentDialogAction) {
      case 'add':
        this._saveCalendar(content);
        break;
      case 'rename':
        this._renameCalendar(content);
        break;
    }
  },

  _saveCalendar: function(name) {
    if (!this._checkNameAndRefocus(name)) {
      return;
    }

    this.dialogController.clearMessage();
    var calendarStore = this.app.store('Calendar');
    var calendar = {
      accountId: this.dbListener.getLocalAccountId(),
      remote: {}
    };
    calendar.remote.name = name;
    calendar.remote.timeStamp = new Date().getTime();
    calendarStore.persist(calendar, (err, id, model) => {
      if (err) {
        console.error('Cannot save calendar', err);
      }
      this._currentDialogAction = '';
      this.dialogController.close();
    });
  },

  _renameCalendar: function(newName) {
    if (!this._checkNameAndRefocus(newName)) {
      return;
    }

    this.dialogController.clearMessage();
    var id = this._currentCalendar.getAttribute('calendar-id');
    var store = this.app.store('Calendar');
    store.get(id, (err, calendar) => {
      if (err) {
        this.dialogController.close();
        return console.error('Cannot fetch calendar', id);
      }
      calendar.remote.name = newName;
      store.persist(calendar, (err, id, model) => {
        if (err) {
          console.error('Cannot save calendar', err);
        }
        this.dialogController.close();
      });
    });
  },

  _checkNameValidation: function(name) {
    if (name.length === 0) {
      return {
        errorCode: NAME_IS_BLANK,
        errorMessage: _('notice-name-is-empty')
      };
    } else {
      for (var key in this.allCalendars) {
        if (name === this.allCalendars[key].remote.name) {
          return {
            errorCode: NAME_HAS_EXIST,
            errorMessage: _('notice-name-already-exist')
          };
        }
      }
      return null;
    }
  },

  _checkNameAndRefocus: function(newName) {
    this._nameState = this._checkNameValidation(newName);
    if (this._nameState) {
      this.dialogController.setMessage(this._nameState.errorMessage);
      nextTick(() => {
        this.dialogController.dialog.dialogTextInput.focus();
        this.dialogController.once('input-blur', this.dealAction.bind(this));
      });
      return false;
    }
    return true;
  },

  _deleteCalendar: function() {
    var id = this._currentCalendar.getAttribute('calendar-id');
    var store = this.app.store('Calendar');
    store.remove(id, (err, id) => {
      this.dialogController.close();
    });
  },

  _updateLocalCalendarDOM: function() {
    this.localCalendars.innerHTML = '';
    this.allCalendars.forEach(calendar => {
      this.localCalendars.insertAdjacentHTML('beforeend',
        calendarTemplate.calendarLi.render({
          id: calendar._id,
          name: calendar.remote.name,
          color: calendar.remote.color,
          timeStamp: calendar.remote.timeStamp,
        }));
    });

    var sleector = 'li[tabindex="0"][calendar-id]';
    var elements = this.localCalendars.querySelectorAll(sleector);
    Array.prototype.slice.call(elements).forEach((element) => {
      var calendarId = element.getAttribute('calendar-id');
      if (calendarId === Local.calendarId) {
        softkeyHandler.register(element, {
          lsk: {
            name: 'back',
            action: () => {
              this._goToAdvancedSettings();
              return false;
            }
          }
        });
      } else {
        softkeyHandler.register(element, {
          lsk: {
            name: 'back',
            action: () => {
              this._goToAdvancedSettings();
              return false;
            }
          },
          dpe: {
            name: 'rename',
            action: () => {
              this._popUpDialog('rename', element);
              return false;
            }
          },
          rsk: {
            name: 'delete',
            action: () => {
              this._popUpDialog('delete', element);
              return false;
            }
          }
        });
      }
    });
  },

  initHeader: function() {
    softkeyHandler.register(this.createAccount, {
      lsk: {
        name: 'back',
        action: () => {
          this._goToAdvancedSettings();
          return false;
        }
      },
      dpe: {
        name: 'select',
        action: () => {
          this._showOptionMenu();
          return false;
        }
      }
    });
  },

  _showOptionMenu: function() {
    var selectKey = false;
    var items = [
      {
        title: _('preset-google'),
        key: 'google'
      },
      {
        title: _('preset-yahoo'),
        key: 'yahoo'
      },
      {
        title: _('preset-caldav'),
        key: 'caldav'
      }
    ];

    this.optionMenuController.once('closed', function() {
      if (!selectKey) {
        this.element.focus();
      }
      selectKey = false;
    }.bind(this));

    this.optionMenuController.once('selected', function(optionKey) {
      switch (optionKey) {
        case 'google':
        case 'yahoo':
        case 'caldav':
          selectKey = true;
          router.go('/create-account/' + optionKey);
          break;
      }
    }.bind(this));

    this.optionMenuController.show({
      items: items
    });
  },

  _parseAccountId: function() {
    var eventElement = document.activeElement;
    var accountId = eventElement.getAttribute('id');
    if (accountId) {
      return accountId.substring(accountId.indexOf(ACCOUNT_PREFIX) +
        ACCOUNT_PREFIX.length);
    } else {
      return '';
    }
  },

  _addAccount: function(id, model) {
    if (!this._displayAccount(model)) {
      return;
    }

    var idx = this.accountList.children.length;
    var item = template.account.render(this._formatModel(model));
    this.accountList.insertAdjacentHTML('beforeend', item);

    if (model.error) {
      this.accountList.children[idx].classList.add('error');
    }

    var accountElement = document.getElementById('account-' + id);
    softkeyHandler.register(accountElement, {
      lsk: {
        name: 'back',
        action: () => {
          this._goToAdvancedSettings();
          return false;
        }
      },
      dpe: {
        name: 'view',
        action: () => {
          var accountId = this._parseAccountId();
          router.go('/account/detail/' + accountId);
          return false;
        }
      },
      rsk: {
        name: 'remove',
        action: () => {
          this._deleteRecord(this._parseAccountId());
          this.showNotices([{name: 'remove-account'}]);
          return false;
        }
      }
    });
  },

  _updateAccount: function(id, model) {
    var elementId = this.idForModel(ACCOUNT_PREFIX, id);
    var el = document.getElementById(elementId);
    if (!el) {
      return console.error('trying to update account that was not rendered',
        id,
        elementId
      );
    }

    if (el.classList.contains('error') && !model.error) {
      el.classList.remove('error');
    }

    if (model.error) {
      el.classList.add('error');
    }
  },

  _removeAccount: function(id) {
    var el = document.getElementById(this.idForModel(ACCOUNT_PREFIX, id));

    if (el) {
      /** @type {Node} */
      var parentNode = el.parentNode;
      parentNode.removeChild(el);
    }
  },

  _deleteRecord: function(id) {
    var app = this.app;
    var store = app.store('Account');

    // begin the removal (which will emit the preRemove event) but don't wait
    // for it to complete...
    store.remove(id);
  },

  render: function() {
    var self = this;

    function renderAccounts(err, accounts) {
      var elements = Array.prototype.slice.call(
        self.accountList.getElementsByClassName('user'));
      elements.forEach(function(element) {
        element.parentChild.removeChild(element);
      });
      for (var id in accounts) {
        self._addAccount(id, accounts[id]);
      }
      if (self.onrender) {
        self.onrender();
      }
    }

    var accounts = this.app.store('Account');
    accounts.all(renderAccounts);
  }
};

SetupCalendar.prototype.onfirstseen = SetupCalendar.prototype.render;

});
