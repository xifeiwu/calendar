define(function(require, exports, module) {
'use strict';

var Responder = require('responder');
var Local = require('provider/local');

function Listener(app) {
  Responder.call(this);
  this.app = app;
  this.accountStore = this.app.store('Account');
  this.accountStore.all().then((accounts) => {
    this.accountList = accounts;
    for (var key in this.accountList) {
      if (this._isLocalAccount(this.accountList[key])) {
        this.localAccountId = this.accountList[key]._id;
        break;
      }
    }
    this._observeAccountStore();
  });
  this.calendarStore = this.app.store('Calendar');
  this.calendarStore.all().then((calendars) => {
    this.calendarList = calendars;
    this._observeCalendarStore();
  });
}
module.exports = Listener;

Listener.prototype = {
  __proto__: Responder.prototype,

  localAccountId: null,
  calendarList: {},
  accountList: {},

  _observeAccountStore: function() {
    this.accountStore.on('add',
      this._dbListener.bind(this, 'account', 'add'));
    this.accountStore.on('remove',
      this._dbListener.bind(this, 'account', 'remove'));
  },

  _observeCalendarStore: function() {
    this.calendarStore.on('add',
      this._dbListener.bind(this, 'calendar', 'add'));
    this.calendarStore.on('update',
      this._dbListener.bind(this, 'calendar', 'update'));
    this.calendarStore.on('remove',
      this._dbListener.bind(this, 'calendar', 'remove'));
  },

  _isLocalCalendar: function(calendar) {
    return this.localAccountId && calendar.accountId === this.localAccountId;
  },

  _isLocalAccount: function(account) {
    return account.providerType === 'Local';
  },

  _dbListener: function(dbName, operation, id, model) {
    var isLocalCalendar = false;
    switch (dbName) {
      case 'calendar':
        switch (operation) {
          case 'add':
          case 'update':
            this.calendarList[id] = model;
            if (this._isLocalCalendar(this.calendarList[id])) {
              isLocalCalendar = true;
            }
            break;
          case 'remove':
            if (id in this.calendarList) {
              if (this._isLocalCalendar(this.calendarList[id])) {
                isLocalCalendar = true;
              }
              delete this.calendarList[id];
            }
            break;
        }
        break;
      case 'account':
        switch (operation) {
          case 'add':
            this.accountList[id] = model;
            break;
          case 'remove':
            if (id in this.accountList) {
              delete this.accountList[id];
            }
            break;
        }
        break;
    }
    this._emitSignal(dbName, isLocalCalendar);
  },

  _sortCalendarByTime: function() {
    return Object.keys(this.calendarList)
      .map(key => {
        return this.calendarList[key];
      })
      .sort((a, b) => {
        if (a._id ===  Local.calendarId) {
          return true;
        }
        if (!a.remote || !a.remote.timeStamp) {
          return false;
        } else if (!b.remote || !b.remote.timeStamp) {
          return true;
        }
        return a.remote.timeStamp - b.remote.timeStamp;
      });
  },

  _sortAccountByType: function() {
    return Object.keys(this.accountList)
      .map(key => {
        return this.accountList[key];
      })
      .sort(account => {
        return account.providerType === 'Local';
      });
  },

  _emitSignal: function(dbName, emitLocalChange) {
    switch (dbName) {
      case 'calendar':
        var calendarArray = this._sortCalendarByTime();
        if (emitLocalChange) {
          this.emit('local-calendar-change', calendarArray.filter(
            (calendar) => {
              return this._isLocalCalendar(calendar);
            })
          );
        }
        this.emit('calendar-change', calendarArray);
        break;
      case 'account':
        var accountArray = this._sortAccountByType();
        if (emitLocalChange) {
          this.emit('local-account-change', accountArray.filter(
            (account) => {
              return this._isLocalAccount(account);
            })
          );
        }
        this.emit('account-change', accountArray);
        break;
    }
  },

  getData: function(dbName, getLocalOnly) {
    switch (dbName) {
      case 'calendar':
        var calendarArray = this._sortCalendarByTime();
        if (getLocalOnly) {
          return calendarArray.filter(
            (calendar) => {
              return this._isLocalCalendar(calendar);
            });
        }
        return calendarArray;
      case 'account':
        var accountArray = this._sortAccountByType();
        if (getLocalOnly) {
          return accountArray.filter(
            (account) => {
              return this._isLocalAccount(account);
            });
        }
        return accountArray;
    }
  },

  getAllCalendars: function() {
    return this.getData('calendar');
  },

  getLocalCalendars: function() {
    return this.getData('calendar', true);
  },

  getAllAccounts: function() {
    return this.getData('account');
  },

  getLocalAccounts: function() {
    return this.getData('account', true);
  },

  getLocalAccountId: function() {
    return this.localAccountId;
  }
};

});
