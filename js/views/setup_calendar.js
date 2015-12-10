define(function(require, exports, module) {
'use strict';

var View = require('view');
var providerFactory = require('provider/provider_factory');
var router = require('router');
var template = require('templates/account');
require('dom!setup-calendar-view');
require('shared/h5-option-menu/dist/amd/script');

var ACCOUNT_PREFIX = 'account-';

function SetupCalendar(options) {
  View.apply(this, arguments);
  this._initEvents();
  this.initOptionMenu();
  this.initHeader();
}
module.exports = SetupCalendar;

SetupCalendar.prototype = {
  __proto__: View.prototype,

  selectors: {
    element: '#setup-calendar-view',
    header: '#setup-calendar-header',
    accountList: '#setup-calendar-view .account-list',
    createAccount: '#setup-calendar-view .sk-add-account',
    optionMenu: '#add-account-option-menu',
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
      dpe: {
        name: 'select',
        action: () => {
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
  }
};

SetupCalendar.prototype.onfirstseen = SetupCalendar.prototype.render;

});
