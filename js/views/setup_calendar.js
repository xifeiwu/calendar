/* global SoftkeyHandler KeyEvent */
define(function(require, exports, module) {
'use strict';

var View = require('view');
var providerFactory = require('provider/provider_factory');
var router = require('router');
var template = require('templates/account');
var Local = require('provider/local');
var _ = navigator.mozL10n.get;
require('dom!setup-calendar-view');
require('shared/h5-dialog/dist/amd/script');

var ACCOUNT_PREFIX = 'account-';

function SetupCalendar(options) {
  View.apply(this, arguments);
  this.optionMenuController = this.app.optionMenuController;
  this._initEvents();
  this.initHeader();
  this.localCalendarList = {};
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
    h5Dialog: '#setup-calendar-view .h5-dialog-container h5-dialog',
    localCalendars: '#setup-calendar-view .local-calendars',
    deleteAccount: '.sk-account',
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

  get deleteAccount() {
    return this._findElement('deleteAccount');
  },

  get addLocalCalendar() {
    return this._findElement('addLocalCalendar');
  },

  get h5Dialog() {
    return this._findElement('h5Dialog');
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
      },
      dpe: {
        name: 'select',
        action: () => {
          this._popUpDialog('add');
        }
      }
    });

    /**
     * When the dialogTextInput get focus, the owner of softkey is
     * Input Method, so we have to listen the keydown event,
     * and do something we need.
     * dpe key is used to get the value in dialogTextInput, as the evt.key
     * passed to dialogTextInput is undefined, evt.keyCode is used.
     * lsk is used to cancel the operation of input, if we do not stop
     * keydown propagation, the key down event will be passed to the current
     * page, it is not we want. The evt.keyCode passed to dialogTextInput
     * is 0, which is no correct, so evt.key is used.
    */
    this.h5Dialog.dialogTextInput.addEventListener('keydown', (evt) => {
      if (evt.keyCode === KeyEvent.DOM_VK_RETURN) {
        switch (this._currentDialogAction) {
          case 'add':
            this._saveCalendar(this.h5Dialog.dialogTextInput.value.trim());
            break;
          case 'rename':
            this._renameCalendar(this.h5Dialog.dialogTextInput.value.trim());
            break;
        }
        evt.stopPropagation();
        evt.preventDefault();
      }
      if (evt.key === 'AcaSoftLeft') {
          this._closeDialog();
          evt.stopPropagation();
          evt.preventDefault();
      }
    });

    this.h5Dialog.addEventListener('keydown', (evt) => {
      switch (evt.key) {
        case 'AcaSoftLeft':
          this._closeDialog();
          evt.preventDefault();
        break;
        case 'AcaSoftRight':
          if (this._currentDialogAction &&
              this._currentDialogAction === 'delete') {
            this._deleteCalendar();
          }
        break;
      }
      evt.stopPropagation();
      evt.preventDefault();
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

  handleKeyDownEvent: function(evt) {
    switch (evt.key) {
      case 'Enter':
        break;
      case 'Accept':
        break;
      case 'AcaSoftLeft':
        router.go('/advanced-settings/');
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
    switch (action) {
      case 'add':
        this.h5Dialog.open({
          header: _('new-calendar'),
          dialogType: 'prompt'
        });
        break;
      case 'delete':
        name = element.querySelector('.setup-calendar-p').innerHTML;
        SoftkeyHandler.register(this.h5Dialog, {
          lsk: {
            name: 'cancel'
          },
          rsk: {
            name: 'delete'
          }
        });
        this.h5Dialog.open({
          message: _('delete-calendar') + name + ' ?',
          dialogType: 'confirm'
        });
        break;
      case 'rename':
        name = element.querySelector('.setup-calendar-p').innerHTML;
        this.h5Dialog.open({
          header: _('rename-calendar'),
          dialogType: 'prompt',
          initialValue: name
        });
        break;
    }
  },

  _closeDialog: function() {
    if (this.h5Dialog && this.h5Dialog.classList.contains('opened')) {
      this.h5Dialog.close();
      this.rootElement.focus();
    }
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

  _saveCalendar: function(name) {
    if (name.length === 0) {
      return;
    }
    var self = this;
    function persist(err, id, model) {
      if (err) {
        console.error('Cannot save calendar', err);
      }
      self._closeDialog();
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
      this._closeDialog();
    });
  },

  _renameCalendar: function(newName) {
    if (newName.length === 0) {
      return;
    }
    var self = this;
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
      self._closeDialog();
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
      SoftkeyHandler.register(element, {
        lsk: {
          name: 'cancel',
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
    });
  },

  initHeader: function() {
    SoftkeyHandler.register(this.createAccount, {
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
      this.rootElement.focus();
    }.bind(this));

    this.optionMenuController.once('selected', function(optionKey) {
      router.go('/create-account/' + optionKey);
    }.bind(this));

    this.optionMenuController.show({
      items: items
    });
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

    SoftkeyHandler.register(this.deleteAccount, {
      rsk: {
        name: 'remove',
        action: () => {
          var eventElement = document.activeElement;
          var accountId = eventElement.getAttribute('id');
          var length = accountId.indexOf(ACCOUNT_PREFIX) +
                       ACCOUNT_PREFIX.length;
          var id = accountId.substring(length);
          this._deleteRecord(id);
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
