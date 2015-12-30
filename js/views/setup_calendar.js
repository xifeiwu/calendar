/* global SoftkeyHandler KeyEvent */
define(function(require, exports, module) {
'use strict';

var View = require('view');
var providerFactory = require('provider/provider_factory');
var router = require('router');
var template = require('templates/account');
var Local = require('provider/local');
var debug = require('debug')('setup_calendar');
var _ = navigator.mozL10n.get;
require('dom!setup-calendar-view');

var ACCOUNT_PREFIX = 'account-';

function SetupCalendar(options) {
  View.apply(this, arguments);
  this.optionMenuController = this.app.optionMenuController;
  this._initEvents();
  this.initHeader();
  this.localCalendarList = {};
  this.dialogController = this.app.dialogController;
}
module.exports = SetupCalendar;

SetupCalendar.prototype = {
  __proto__: View.prototype,

  localCalendarList: null,
  localAccountId: '',
  _currentDialogAction: '',
  _currentCalendar: null,

  selectors: {
    element: '#setup-calendar-view',
    header: '#setup-calendar-header',
    accountList: '#setup-calendar-view .account-list',
    createAccount: '#setup-calendar-view .sk-add-account',
    addLocalCalendar: '#setup-calendar-view .add-local-calendar',
    localCalendars: '#setup-calendar-view .local-calendars',
    accountItem: '.sk-account',
    errors: '#setup-calendar-view .errors',
    status: '#setup-calendar-view section[role="status"]',
    notices: '#setup-calendar-view .notices'
  },

  get rootElement() {
    return this._findElement('element');
  },

  get createAccount() {
    return this._findElement('createAccount');
  },

  get accountList() {
    return this._findElement('accountList');
  },

  get accountItem() {
    return this._findElement('accountItem');
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

    SoftkeyHandler.register(this.addLocalCalendar, {
      lsk: {
        name: 'back',
        action: () => {
          this._goToAdvancedSettings();
        }
      },
      dpe: {
        name: 'select',
        action: () => {
          this._popUpDialog('add');
        }
      }
    });
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    this._keyDownHandler = this.handleKeyDownEvent.bind(this);
    window.addEventListener('keydown', this._keyDownHandler, false);
    this.rootElement.focus();
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
              name: 'ok',
              action: () => {
                var content = this.dialogController.getInputValue().trim();
                this._saveCalendar(content);
              }
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
              }
            },
            rsk: {
              name: 'delete',
              action: () => {
                if (this._currentDialogAction &&
                    this._currentDialogAction === 'delete') {
                  this._deleteCalendar();
                }
                this.dialogController.close();
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
              name: 'ok',
              action: () => {
                var content = this.dialogController.getInputValue().trim();
                this._renameCalendar(content);
              }
            }
          }
        };
        this._openDialog(option);
        break;
    }
  },

  _openDialog: function(option) {
    this.dialogController.once('opened', () => {
    });
    this.dialogController.once('closed', () => {
      this.rootElement.focus();
    });
    this.dialogController.once('input-blur', () => {
      this.dialogController.close();
      this.rootElement.focus();
    });
    this.dialogController.show(option);
  },

  _getLocalAccountId: function() {
    return new Promise((resolve, reject) => {
      if (this.localAccountId.length) {
        resolve();
      } else {
        var accountStore = this.app.store('Account');
        accountStore.all().then((accounts) => {
          for (var key in accounts) {
            if (accounts[key].preset === 'local') {
              this.localAccountId = accounts[key]._id;
              break;
            }
          }
          resolve();
        });
      }
    });
  },

  _checkCalendarName: function(name) {
    var _isNameExist = false;
    for (var key in this.localCalendarList) {
      if (name === this.localCalendarList[key].remote.name) {
        _isNameExist = true;
        break;
      }
    }
    return _isNameExist;
  },

  _saveCalendar: function(name) {
    if (name.length === 0) {
      return;
    }
    var self = this;
    if (this._checkCalendarName(name)) {
      self.dialogController.close();
      this.showNotices([{name: 'name-already-exist'}]);
      return;
    }
    function persist(err, id, model) {
      if (err) {
        console.error('Cannot save calendar', err);
      }
      self.dialogController.close();
    }

    this._getLocalAccountId().then(() => {
      var calendarStore = this.app.store('Calendar');
      var calendar = {
        accountId: this.localAccountId,
        remote: Local.defaultCalendar()
      };
      calendar.remote.name = name;
      calendarStore.persist(calendar, persist.bind(this));
    }).catch((err) => {
      console.error('Error in _saveCalendar.', err);
      self.dialogController.close();
    });
  },

  _renameCalendar: function(newName) {
    if (newName.length === 0) {
      return;
    }
    var self = this;
    if (this._checkCalendarName(newName)) {
      self.dialogController.close();
      this.showNotices([{name: 'name-already-exist'}]);
      return;
    }
    var id = this._currentCalendar.getAttribute('calendar-id');
    var store = this.app.store('Calendar');
    function onRemove(err, id) {
      self._saveCalendar(newName);
    }
    store.remove(id, onRemove);
  },

  _deleteCalendar: function() {
    var self = this;
    var id = this._currentCalendar.getAttribute('calendar-id');
    function onRemove(err, id) {
      self.dialogController.close();
    }
    var store = this.app.store('Calendar');
    store.remove(id, onRemove);
  },

  _getLocalCalendars: function() {
    return new Promise((resolve, reject) => {
      if (this.localCalendarList &&
        Object.keys(this.localCalendarList).length) {
        resolve();
      } else {
        var store = this.app.store('Calendar');
        store.all().then((calendars) => {
          for (var key in calendars) {
            if (calendars[key].accountId === this.localAccountId) {
              this.localCalendarList[key] = calendars[key];
            }
          }
          this._observeLocalCalendarStore();
          resolve();
        });
      }
    });
  },

  _observeLocalCalendarStore: function() {
    var store = this.app.store('Calendar');
    // calendar store events
    store.on('add', this._dbListener.bind(this, 'add'));
    store.on('update', this._dbListener.bind(this, 'update'));
    store.on('remove', this._dbListener.bind(this, 'remove'));
  },

  _dbListener: function(operation, id, model) {
    if (this.localAccountId !== model.accountId) {
      return;
    }
    if (operation === 'add' || operation === 'update') {
      this.localCalendarList[id] = model;
    } else if (operation === 'remove') {
      delete this.localCalendarList[id];
    }
    this._updateLocalCalendarDOM();
  },

  _calendarTemplate: function(id, name, color){
    var html = `
      <li role="presentation" tabindex="0" calendar-id=${id}>
        <div class="on-off-line-calendar">
          <div class="indicator"
            style="background-color: ${color} !important;"></div>
            <div class="setup-calendar-id">
              <p class="setup-calendar-p">${name}</p>
            </div>
          </div>
      </li>`;
    return html;
  },

  _updateLocalCalendarDOM: function() {
    this.localCalendars.innerHTML = '';
    for (var key in this.localCalendarList) {
      var id = this.localCalendarList[key]._id;
      var remote = this.localCalendarList[key].remote;
      this.localCalendars.insertAdjacentHTML('beforeend',
        this._calendarTemplate(id, remote.name, remote.color));
    }
    var elements = this.localCalendars.querySelectorAll('li[tabindex="0"]');
    Array.prototype.slice.call(elements).forEach((element) => {
      var calendarId = element.getAttribute('calendar-id');
      if (calendarId === Local.calendarId) {
        SoftkeyHandler.register(element, {
          lsk: {
            name: 'back',
            action: () => {
              this._goToAdvancedSettings();
            }
          }
        });
      } else {
        SoftkeyHandler.register(element, {
          lsk: {
            name: 'back',
            action: () => {
              this._goToAdvancedSettings();
            }
          },
          dpe: {
            name: 'rename',
            action: () => {
              this._popUpDialog('rename', element);
            }
          },
          rsk: {
            name: 'delete',
            action: () => {
              this._popUpDialog('delete', element);
            }
          }
        });
      }
    });
  },

  initHeader: function() {
    SoftkeyHandler.register(this.createAccount, {
      lsk: {
        name: 'back',
        action: () => {
          this._goToAdvancedSettings();
        }
      },
      dpe: {
        name: 'select',
        action: () => {
          this._showOptionMenu();
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
      document.querySelector('#setup-calendar-view').classList.
        remove('option-menu-bg');
      this.rootElement.focus();
    }.bind(this));

    this.optionMenuController.once('selected', function(optionKey) {
      router.go('/create-account/' + optionKey);
    }.bind(this));

    document.querySelector('#setup-calendar-view').classList.
      add('option-menu-bg');
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

    // TODO:
    // Using accountItem to indicate an account item is not
    // a good way.
    SoftkeyHandler.register(this.accountItem, {
      lsk: {
        name: 'back',
        action: () => {
          this._goToAdvancedSettings();
        }
      },
      dpe: {
        name: 'view',
        action: () => {
          var accountId = this._parseAccountId();
          router.go('/account/detail/' + accountId);
        }
      },
      rsk: {
        name: 'remove',
        action: () => {
          this._deleteRecord(this._parseAccountId());
          this.showNotices([{name: 'remove-account'}]);
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

    this._getLocalAccountId().then(() => {
      return this._getLocalCalendars();
    }).then(()=> {
      return this._updateLocalCalendarDOM();
    }).catch((error) => {
      console.error('init local calendar list Error.', error);
    });
  }
};

SetupCalendar.prototype.onfirstseen = SetupCalendar.prototype.render;

});
