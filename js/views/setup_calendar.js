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
}
module.exports = SetupCalendar;

SetupCalendar.prototype = {
  __proto__: View.prototype,

  _currentDialogAction: '',
  _currentCalendar: null,

  selectors: {
    element: '#setup-calendar-view',
    header: '#setup-calendar-header',
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
    this._keyDownHandler = this.handleKeyDownEvent.bind(this);
    window.addEventListener('keydown', this._keyDownHandler, false);
    this.element.focus();
  },

  oninactive: function() {
    View.prototype.oninactive.call(this);
    window.removeEventListener('keydown', this._keyDownHandler);
  },

  _goToAdvancedSettings: function() {
    router.go('/advanced-settings/');
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

  _popUpDialog: function(action, element) {
    this._currentDialogAction = action;
    this._currentCalendar = element;
    var name = '';
    var option = null;
    switch (action) {
      case 'add':
        option = {
          header: _('new-calendar'),
          dialogType: 'prompt',
          inputSoftKeysHandler: {
            lsk: {
              name: 'cancel',
              action: () => {
                this.dialogController.close();
              }
            },
            dpe: {
              name: 'ok'
            }
          }
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
          initialValue: name,
          inputSoftKeysHandler: {
            lsk: {
              name: 'cancel',
              action: () => {
                this.dialogController.close();
              }
            },
            dpe: {
              name: 'ok'
            }
          }
        };
        this._openDialog(option);
        break;
    }
  },

  _openDialog: function(option) {
    this.dialogController.once('opened', () => {
      var diaInput = document.activeElement;
      if (diaInput.tagName === 'INPUT') {
        var pos = diaInput.value.length;
        diaInput.setSelectionRange(pos, pos);
      }
    });
    this.dialogController.once('closed', () => {
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

  _checkCalendarName: function(name) {
    var _isNameExist = false;
    for (var key in this.allCalendars) {
      if (name === this.allCalendars[key].remote.name) {
        _isNameExist = true;
        break;
      }
    }
    return _isNameExist;
  },

  _saveCalendar: function(name, timeStamp) {
    if (!this.nameCheck(name)) {
      return;
    }

    this.dialogController.clearMessage();
    var calendarStore = this.app.store('Calendar');
    var calendar = {
      accountId: this.dbListener.getLocalAccountId(),
      remote: Local.defaultCalendar()
    };
    calendar.remote.name = name;
    if (timeStamp) {
      calendar.remote.timeStamp = timeStamp;
    } else {
      calendar.remote.timeStamp = new Date().getTime();
    }
    calendarStore.persist(calendar, (err, id, model) => {
      if (err) {
        console.error('Cannot save calendar', err);
      }
      this._currentDialogAction = '';
      this.dialogController.close();
    });
  },

  _renameCalendar: function(newName) {
    if (!this.nameCheck(newName)) {
      return;
    }

    this.dialogController.clearMessage();
    var id = this._currentCalendar.getAttribute('calendar-id');
    var timeStamp = this._currentCalendar.getAttribute('time-stamp');
    var store = this.app.store('Calendar');
    store.remove(id, (err, id) => {
      if (!err) {
        nextTick(() => {
          this._saveCalendar(newName, timeStamp);
        });
      } else {
        this._currentDialogAction = '';
        this.dialogController.close();
      }
    });
  },

  nameCheck: function(newName) {
    var self = this;
    if (newName.length === 0) {
      this._currentDialogAction = '';
      this.dialogController.close();
      return false;
    }
    if (this._checkCalendarName(newName)) {
      this.dialogController.setMessage(_('notice-name-already-exist'));
      nextTick(() => {
        this.dialogController.dialog.dialogTextInput.focus();
        this.dialogController.once('input-blur', this.dealAction.bind(self));
      });
      var inputContent = this.dialogController.dialog.dialogTextInput;
      inputContent.addEventListener('keydown',
        function _clearMessage () {
          nextTick(() => {
            if (!self._checkCalendarName(inputContent.value)) {
              self.dialogController.clearMessage();
              inputContent.removeEventListener('keydown', _clearMessage);
            }
          });
        }
      );
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
      this.element.focus();
    }.bind(this));

    this.optionMenuController.once('selected', function(optionKey) {
      switch (optionKey) {
        case 'google':
        case 'yahoo':
        case 'caldav':
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
