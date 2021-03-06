/* global softkeyHandler */
define(function(require, exports, module) {
'use strict';

var View = require('view');
var template = require('templates/account_detail_item');
var router = require('router');
var _ = navigator.mozL10n.get;

require('dom!account-detail-view');

function AccountDetail(options) {
  View.apply(this, arguments);

  this.accountStore = this.app.store('Account');
  this.calendarStore = this.app.store('Calendar');
  this.accountId = null;
  this.count = 0;
}
module.exports = AccountDetail;

AccountDetail.prototype = {
  __proto__: View.prototype,

  selectors: {
    element: '#account-detail-view',
    header: '#account-detail-header',
    calendars: '#calendar-list'
  },

  get calendars() {
    return this._findElement('calendars');
  },

  _updateUI: function() {
    this.accountStore.get(this.accountId, (err, account) => {
      if (err) {
        return console.error('Get account ' + this.accountId +
          ' error: ' + err);
      }

      this.header.textContent = _('account-detail-header', {
        preset: _('preset-' + account.preset)
      });

      this.calendarStore.remotesByAccount(account._id, (err, calendars) => {
        if (err) {
          return console.error('Get calendars ' + account._id +
            ' error: ' + err);
        }

        var cals = [];
        for(var key in calendars){
          cals.push(calendars[key]);
        }
        this._render(cals);
        this._focus();
      });
    });
  },

  _render: function(records) {
    this.count = records.length;
    this.calendars.innerHTML =
      records.map(this._renderCalendar, this).join('');
  },

  _renderCalendar: function(record) {
    return template.item.render({
      calendarId: record._id,
      name: record.remote.name,
      color: record.remote.color
    });
  },

  _focus: function() {
    this.element.focus();
    if (this.count > 0) {
      var events = this.calendars.querySelectorAll('li');
      if (events && events.length > 0) {
        events[0].focus();
      }
    }
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    this._updateUI();
    softkeyHandler.register(this.calendars, {
      lsk: {
        name: 'back',
        action: () => {
          router.go('/setup-calendar/');
          return false;
        }
      },
      dpe: {},
      rsk: {}
    });
  },

  oninactive: function() {
    View.prototype.oninactive.apply(this, arguments);
  },

  dispatch: function(data) {
    var id = data.params.id;
    this.accountId = id;
  }
};

});
