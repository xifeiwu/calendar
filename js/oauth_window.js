define(function(require, exports, module) {
'use strict';

var QueryString = require('querystring');

/**
 * Creates a oAuth dialog given a set of parameters.
 *
 *    var oauth = new OAuthWindow(
 *      elementContainer,
 *      'https://accounts.google.com/o/oauth2/auth',
 *      {
 *        response_type: 'code',
 *        client_id: 'xxx',
 *        scope: 'https://www.googleapis.com/auth/calendar',
 *        redirect_uri: 'xxx',
 *        state: 'foobar',
 *        access_type: 'offline',
 *        approval_prompt: 'force'
 *      }
 *    );
 *
 *    oauth.oncomplete = function(evt) {
 *      if (evt.detail.code) {
 *        // success
 *      }
 *    };
 *
 *    oauth.onabort = function() {
 *      // oauth was aborted
 *    };
 *
 *
 */
function OAuthWindow(server, params) {
  if (!params.redirect_uri) {
    throw new Error(
      'must provide params.redirect_uri so oauth flow can complete'
    );
  }

  this._apiParams = {};
  for (var key in params) {
    this._apiParams[key] = params[key];
  }

  this._windowOpened = false;
  this._browserWindow = null;
  this._monitorTimer = null;

  this._target = server + '?' + QueryString.stringify(params);

  this._handleFinalRedirect = this._handleFinalRedirect.bind(this);
  this._startMonitorWindow = this._startMonitorWindow.bind(this);
}

module.exports = OAuthWindow;

OAuthWindow.prototype = {

  get isOpen() {
    return this._windowOpened;
  },

  _handleFinalRedirect: function(event) {
    var origin = event.origin || event.originalEvent.origin;

    this.close();

    if (this._apiParams.redirect_uri.indexOf(origin) === -1) {
      return;
    }

    var msg = event.data;
    if (this.oncomplete) {
      var params;

      // find query string
      var queryStringIdx = msg.indexOf('?');
      if (queryStringIdx !== -1) {
        params = QueryString.parse(msg.slice(queryStringIdx + 1));
      }
      this.oncomplete(params || {});
    }
  },

  _startMonitorWindow: function() {
    if (this._browserWindow && !this._browserWindow.closed) {
      this._monitorTimer = window.setTimeout(this._startMonitorWindow, 100);
    } else {
      if (this.isOpen) {
        if (this.onabort) {
          this.onabort();
        }
        this.close();
      }
    }
  },

  _stopMonitorWindow: function() {
    if (this._monitorTimer) {
      window.clearTimeout(this._monitorTimer);
      this._monitorTimer = null;
    }
  },

  open: function() {
    if (this.isOpen) {
      throw new Error('attempting to open frame while another is open');
    }

    this._browserWindow = window.open(this._target, '', 'dialog');
    window.addEventListener('message', this._handleFinalRedirect);
    this._windowOpened = true;
    this._startMonitorWindow();
  },

  close: function() {
    this._stopMonitorWindow();

    if (!this.isOpen) {
      return;
    }

    window.removeEventListener('message', this._handleFinalRedirect);

    if (this._browserWindow && !this._browserWindow.closed) {
      this._browserWindow.close();
      this._browserWindow = null;
    }
    this._windowOpened = false;
  }
};

});
