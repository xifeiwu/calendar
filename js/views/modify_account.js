/* global softkeyHandler */
define(function(require, exports, module) {
'use strict';

var Account = require('models/account');
var AccountCreation = require('utils/account_creation');
var OAuthWindow = require('oauth_window');
var Presets = require('presets');
var URI = require('utils/uri');
var View = require('view');
var router = require('router');

require('dom!modify-account-view');

var DEFAULT_AUTH_TYPE = 'basic';
var OAUTH_AUTH_CREDENTIALS = [
  'client_id',
  'scope',
  'redirect_uri',
  'state'
];

function ModifyAccount(options) {
  View.apply(this, arguments);

  this.deleteRecord = this.deleteRecord.bind(this);
  this.cancel = this.cancel.bind(this);
  this.displayOAuth2 = this.displayOAuth2.bind(this);
  this.hideHeaderAndForm = this.hideHeaderAndForm.bind(this);
  this.cancelDelete = this.cancelDelete.bind(this);

  this.accountHandler = new AccountCreation(this.app);
  this.accountHandler.on('authorizeError', this);

  // bound so we can add remove listeners
  this._boundSaveUpdateModel = this.save.bind(this, { updateModel: true });
  this.initHeader();

  this.cachedDocKeypressHandler = null;
}
module.exports = ModifyAccount;

ModifyAccount.prototype = {
  __proto__: View.prototype,

  _changeToken: 0,

  selectors: {
    element: '#modify-account-view',
    form: '#modify-account-view .modify-account-form',
    fields: '*[name]',
    deleteButton: '#modify-account-view .delete-confirm',
    deleteRecordButton: '.delete-record',
    cancelDeleteButton: '#modify-account-view .delete-cancel',
    status: '#modify-account-view section[role="status"]',
    oauth2Window: '#oauth2',
    oauth2SignIn: '#modify-account-view .force-oauth2',
    username: '#modify-account-view .modify-account-username',
    password: '#modify-account-view .modify-account-password',
    url: '#modify-account-view .modify-account-url'
  },

  progressClass: 'in-progress',
  removeDialogClass: 'remove-dialog',

  get authenticationType() {
    if (this.preset && this.preset.authenticationType) {
      return this.preset.authenticationType;
    }

    return DEFAULT_AUTH_TYPE;
  },

  get rootElement() {
    return this._findElement('element');
  },

  get oauth2Window() {
    return this._findElement('oauth2Window');
  },

  get oauth2SignIn() {
    return this._findElement('oauth2SignIn');
  },

  get deleteRecordButton() {
    return this._findElement('deleteRecordButton');
  },

  get deleteButton() {
    return this._findElement('deleteButton');
  },

  get cancelDeleteButton() {
    return this._findElement('cancelDeleteButton');
  },

  get form() {
    return this._findElement('form');
  },

  get username() {
    return this._findElement('username');
  },

  get password() {
    return this._findElement('password');
  },

  get url() {
    return this._findElement('url');
  },

  get fields() {
    if (!this._fields) {
      var result = this._fields = {};
      var elements = this.element.querySelectorAll(this.selectors.fields);

      var i = 0;
      var len = elements.length;

      for (i; i < len; i++) {
        var el = elements[i];
        result[el.getAttribute('name')] = el;
      }
    }

    return this._fields;
  },

  handleEvent: function(event) {
    var type = event.type;
    var data = event.data;

    switch (type) {
      case 'authorizeError':
        // we only expect one argument an error object.
        this.showErrors(data[0]);
        break;
    }
  },

  updateForm: function() {
    var update = ['user', 'fullUrl'];

    update.forEach(function(name) {
      var field = this.fields[name];
      field.value = this.model[name];
    }, this);
  },

  updateModel: function() {
    var update = ['user', 'password', 'fullUrl'];

    update.forEach(function(name) {
      var field = this.fields[name];
      var value = field.value;
      if (name === 'fullUrl') {
        // Prepend a scheme if url has neither port nor scheme
        var port = URI.getPort(value);
        var scheme = URI.getScheme(value);
        if (!port && !scheme) {
          value = 'https://' + value;
        }
      }

      this.model[name] = value;
    }, this);
  },

  deleteRecord: function(e) {
    if (e) {
      e.preventDefault();
    }

    var app = this.app;
    var id = this.model._id;
    var store = app.store('Account');

    // begin the removal (which will emit the preRemove event) but don't wait
    // for it to complete...
    store.remove(id);

    // semi-hack clear the :target - harmless in tests
    // but important in the current UI because css :target
    // does not get cleared (for some reason)
    window.location.replace('#');

    // TODO: in the future we may want to store the entry
    // url of this view and use that instead of this
    // hard coded value...
    router.show('/advanced-settings/');
  },

  cancel: function(event) {
    if (event) {
      event.preventDefault();
    }

    window.history.back();
  },

  cancelDelete: function(event) {
    this.element.classList.remove(this.removeDialogClass);
    this.cancel(event);
  },

  save: function(options, e) {
    if (e) {
      e.preventDefault();
    }
    var list = this.element.classList;
    var self = this;

    if (this.app.offline()) {
      this.showErrors([{name: 'offline'}]);
      return;
    }

    list.add(this.progressClass);

    if (options && options.updateModel) {
      this.updateModel();
    }

    this.accountHandler.send(this.model, function(err) {
      list.remove(self.progressClass);
      if (!err) {
        router.go(self.completeUrl);
      }
    });
  },

  hideHeaderAndForm: function() {
    this.element.classList.add(this.removeDialogClass);
  },

  displayOAuth2: function(event) {
    if (event) {
      event.preventDefault();
    }

    var self = this;

    navigator.mozApps.getSelf().onsuccess = function(e) {
      var app = e.target.result;
      app.clearBrowserData().onsuccess = function() {
        self._redirectToOAuthFlow();
      };
    };
  },

  /**
   * @param {String} preset name of value in Calendar.Presets.
   */
  _createModel: function(preset, callback) {
    var settings = Presets[preset];
    var model = new Account(settings.options);
    model.preset = preset;
    return model;
  },

  _redirectToOAuthFlow: function() {

    var apiCredentials = this.preset.apiCredentials;
    var params = {
      /*
       * code response type for now might change when we can use window.open
       */
      response_type: 'code',
      /* offline so we get refresh_token[s] */
      access_type: 'offline',
      /* we us force so we always get a refresh_token */
      approval_prompt: 'force'
    };

    OAUTH_AUTH_CREDENTIALS.forEach(function(key) {
      if (key in apiCredentials) {
        params[key] = apiCredentials[key];
      }
    });

    var oauth = this._oauthDialog = new OAuthWindow(
      apiCredentials.authorizationUrl,
      params
    );

    var self = this;

    oauth.open();
    oauth.onabort = function() {
      self.cancel();
    };

    oauth.oncomplete = function(params) {
      if ('error' in params) {
        // Ruh roh
        return self.cancel();
      }

      if (!params.code) {
        return console.error('authentication error');
      }

      // Fistpump!
      self.model.oauth = { code: params.code };
      self.save();
    };
  },

  render: function() {
    if (!this.model) {
      throw new Error('must provider model to ModifyAccount');
    }

    this.form.addEventListener('submit', this._boundSaveUpdateModel);
    this.deleteRecordButton.addEventListener('click', this.hideHeaderAndForm);

    if (this.model._id) {
      this.type = 'update';
      this.deleteButton.addEventListener('click', this.deleteRecord);
      this.cancelDeleteButton.addEventListener('click', this.cancelDelete);
    } else {
      this.type = 'create';
    }

    var list = this.element.classList;
    list.add(this.type);
    list.add('preset-' + this.model.preset);
    list.add('provider-' + this.model.providerType);
    list.add('auth-' + this.authenticationType);

    if (this.model.error) {
      list.add('error');
    }

    if (this.authenticationType === 'oauth2') {
      this.oauth2SignIn.addEventListener('click', this.displayOAuth2);

      if (this.type === 'create') {
        this.displayOAuth2();
      }

      this.fields.user.disabled = true;
    }

    this.form.reset();
    this.updateForm();

    var usernameType = this.model.usernameType;
    this.fields.user.type = (usernameType === undefined) ?
        'text' : usernameType;
  },

  destroy: function() {
    var list = this.element.classList;

    list.remove(this.type);

    list.remove('preset-' + this.model.preset);
    list.remove('provider-' + this.model.providerType);
    list.remove('auth-' + this.authenticationType);
    list.remove('error');
    list.remove(this.removeDialogClass);

    this.fields.user.disabled = false;

    this._fields = null;
    this.form.reset();

    this.deleteRecordButton.removeEventListener('click',
      this.hideHeaderAndForm);
    this.oauth2SignIn.removeEventListener('click', this.displayOAuth2);
    this.deleteButton.removeEventListener('click', this.deleteRecord);
    this.cancelDeleteButton.removeEventListener('click', this.cancelDelete);
    this.form.removeEventListener('submit', this._boundSaveUpdateModel);
  },

  dispatch: function(data) {
    if (this.model) {
      this.destroy();
    }

    var params = data.params;
    var changeToken = ++this._changeToken;

    this.completeUrl = '/setup-calendar/';

    var self = this;

    function displayModel(err, model) {
      self.preset = Presets[model.preset];

      // race condition another dispatch has queued
      // while we where waiting for an async event.
      if (self._changeToken !== changeToken) {
        return;
      }

      if (err) {
        return console.error('Error displaying model in ModifyAccount', data);
      }

      self.model = model;
      self.render();

      if (self.ondispatch) {
        self.ondispatch();
      }
    }

    if (params.id) {
      this.app.store('Account').get(params.id, displayModel);
    } else if (params.preset) {
      displayModel(null, this._createModel(params.preset));
    }
  },

  initHeader: function() {
    softkeyHandler.register(this.form, {
      lsk: {
        name: 'cancel',
        action: () => {
          this.accountHandler.cancel();
          return false;
        }
      },
      rsk: {
        name: 'save',
        action: () => {
          this.save({
            updateModel: true
          });
          return false;
        }
      }
    });
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    this._keyDownHandler = this.handleKeyDownEvent.bind(this);
    window.addEventListener('keydown', this._keyDownHandler, false);
    this.username.on('editstart', this.onUsernameEditStart.bind(this));

    this.cachedDocKeypressHandler = document.onkeypress;
    // Workaround: This page was designed for touch devices, the form in
    // this page would be submitted automatically while received keydown
    // event. So 'enter' key should be consumed and stop it continuately
    // passing to the form.
    document.onkeypress = function(evt) {
      if (evt.keyCode === 13 &&
          evt.target.tagName ==='INPUT') {
        return false;
      }
    };

    this.username.focus();
  },

  handleKeyDownEvent: function(evt) {
    switch (evt.key) {
      case 'Enter':
        break;
      case 'Accept':
        break;
      case 'AcaSoftLeft':
        router.go('/setup-calendar/');
        evt.preventDefault();
        break;
      case 'AcaSoftRight':
        break;
    }
  },

  onUsernameEditStart: function() {
    var input = this.username.querySelector('input');
    if (input.type === 'email') {
      var len = input.value.indexOf('@');
      input.setSelectionRange(len, len);
    }
  },

  oninactive: function() {
    View.prototype.oninactive.apply(this, arguments);
    window.removeEventListener('keydown', this._keyDownHandler);
    document.onkeypress = this.cachedDocKeypressHandler;
    if (this._oauthDialog) {
      this._oauthDialog.close();
      this._oauthDialog = null;
    }
  }
};

});
