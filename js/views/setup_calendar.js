/* global SoftkeyHandler KeyEvent */
define(function(require, exports, module) {
'use strict';

var View = require('view');
var providerFactory = require('provider/provider_factory');
var router = require('router');
var template = require('templates/account');
var debug = require('debug')('setup_calendar');
var Local = require('provider/local');
var _ = navigator.mozL10n.get;
require('dom!setup-calendar-view');
require('shared/h5-option-menu/dist/amd/script');
require('shared/h5-dialog/dist/amd/script');

var ACCOUNT_PREFIX = 'account-';

function SetupCalendar(options) {
  View.apply(this, arguments);
  this._initEvents();
  this.initOptionMenu();
  this.initHeader();
  this.localCalendarList = {};
}
module.exports = SetupCalendar;

SetupCalendar.prototype = {
  __proto__: View.prototype,

  localCalendarList: null,
  localAccountId: '',

  selectors: {
    element: '#setup-calendar-view',
    header: '#setup-calendar-header',
    accountList: '#setup-calendar-view .account-list',
    createAccount: '#setup-calendar-view .sk-add-account',
    optionMenu: '#add-account-option-menu',
    addLocalCalendar: '#setup-calendar-view .add-local-calendar',
    h5Dialog: '#setup-calendar-view .h5-dialog-container h5-dialog',
    localCalendars: '#setup-calendar-view .local-calendars',
    deleteAccount: '.sk-account'
  },

  get rootElement() {
    return this._findElement('element');
  },

  get createAccount() {
    return this._findElement('createAccount');
  },

  get optionMenu() {
   return this._findElement('optionMenu');
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
          this._popUpDialog();
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
          this._saveCalendar(this.h5Dialog.dialogTextInput.value);
          evt.stopPropagation();
          evt.preventDefault();
      }
      if (evt.key === 'AcaSoftLeft') {
          this._closeDialog();
          evt.stopPropagation();
          evt.preventDefault();
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

  handleKeyDownEvent: function(evt) {
    switch (evt.key) {
      case 'Enter':
        break;
      case 'Accept':
        break;
      case 'AcaSoftLeft':
        router.go('/advanced-settings/');
        break;
      case 'AcaSoftRight':
        break;
      }
  },

  _popUpDialog: function() {
    this.h5Dialog.open({
      header: _('new-calendar'),
      dialogType: 'prompt'
    });
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
              this.localAccountId = key;
              break;
            }
          }
          resolve();
        });
      }
    });
  },

  _saveCalendar: function(name) {
    function persist(err, id, model) {
      if (err) {
        console.error('Cannot save calendar', err);
      }
      this._closeDialog();
    }

    this._getLocalAccountId().then(() => {
      var calendarStore = this.app.store('Calendar');
      var calendar = {
        _id: name,
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

  _calendarTemplate: function(name, color){
    var html = `
      <li role="presentation" tabindex="0">
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
      var remote = this.localCalendarList[key].remote;
      this.localCalendars.insertAdjacentHTML('beforeend',
        this._calendarTemplate(remote.name, remote.color));
    }
  },

  initHeader: function() {
    SoftkeyHandler.register(this.createAccount, {
      dpe: {
        name: 'select',
        action: () => {
          this.optionMenu.open();
        }
      }
    });
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
        }
      }
    });
  },

  initOptionMenu: function() {
    this.optionMenu.setOptions({
      items: [
        {
          title: 'google',
          key: 'google'
        },
        {
          title: 'yahoo',
          key: 'yahoo'
        },
        {
          title: 'caldav',
          key: 'caldav'
        }
      ]
    });

    this.optionMenu.on('h5options:closed', function() {
      console.log('h5options:closed.');
      this.rootElement.focus();
    }.bind(this));

    this.optionMenu.on('h5options:opened', function() {
      console.log('h5options:opened');
    }.bind(this));

    this.optionMenu.on('h5options:selected', function(e) {
      var optionKey = e.detail.key;
      console.log('h5options:selected, key is ' + optionKey);
      router.go('/create-account/' + optionKey);
    }.bind(this));
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
      console.error('init local calendar list Error.', err);
    });
  }
};

SetupCalendar.prototype.onfirstseen = SetupCalendar.prototype.render;

});
