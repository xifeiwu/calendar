define(function(require, exports, module) {
'use strict';

var Responder = require('responder');
var debug = require('debug')('controllers/recurring_events');
var nextTick = require('next_tick');
var providerFactory = require('provider/provider_factory');
var Calc = require('calc');

function RecurringEvents(app) {
  this.app = app;
  this.accounts = app.store('Account');
  Responder.call(this);
}
module.exports = RecurringEvents;

RecurringEvents.prototype = {
  __proto__: Responder.prototype,

  startEvent: 'expandStart',
  completeEvent: 'expandComplete',

  /**
   * Adds N number of days to the window to expand
   * events until. Its very important for this number
   * to be greater then the maximum number of days displayed
   * in the month view (or a view with more days) otherwise
   * the view may be loaded without actually expanding all
   * the visible days.
   *
   * @type Number
   */
  paddingInDays: 85,

  /**
   * Amount of time (in MS) to wait between triggering
   * the recurring event expansions.
   */
  waitBeforeMove: 750,

  /**
   * We need to limit the number of tries on expansions
   * otherwise its possible we never complete during error
   * or long recurring event.
   */
  maximumExpansions: 25,

  /**
   * private timeout (as in setTimeout id) use with waitBeforeMove.
   */
  _moveTimeout: null,

  /**
   * True when queue is running...
   */
  pending: false,

  unobserve: function() {
    this.app.timeController.removeEventListener(
      'monthChange',
      this
    );

    this.app.syncController.removeEventListener(
      'syncComplete',
      this
    );
  },

  observe: function() {
    var time = this.app.timeController;

    // expand initial time this is necessary
    // for cases where user has device off for long periods of time.
    if (time.position) {
      this.expand(time.position);
    }

    // register observers
    time.on('monthChange', this);

    // we must re-expand after sync so events at least
    // expand to the current position....
    this.app.syncController.on('syncComplete', this);
  },

  handleEvent: function(event) {
    switch (event.type) {
      case 'syncComplete':
        this.expand(
          this.app.timeController.position
        );
        break;

      case 'monthChange':
        if (this._moveTimeout !== null) {
          clearTimeout(this._moveTimeout);
          this._moveTimeout = null;
        }

        // trigger the event queue when we move
        this._moveTimeout = setTimeout(
          // data[0] is the new date.
          this.expand.bind(this, event.data[0]),
          this.waitBeforeMove
        );
        break;
    }
  },

  /**
   * Ensures we have time converage until the given date.
   * Additional time will be added to the date see .paddingInDays.
   *
   * @param {Date} expandTo date to expand to.
   */
  expand: function(date, callback) {
    var expandSpan = Calc.spanOfMonth(date);
    debug('expand span: ', expandSpan.toJSON());
    if (!callback) {
     callback = function() {};
    }
    this.accounts.all((err, accounts) => {
      if (err) {
        return callback(err);
      }

      var providers = this._getExpandableProviders(accounts);
      var pending = providers.length;

      if (!pending) {
        return nextTick(callback);
      }

      providers.forEach(provider => {
        // entrypoint for expanding recurring event by month span.
        provider.expandRecurrences(expandSpan, (err) => {
          if (--pending <= 0) {
            callback(err);
          }
        });
      });
    });
  },

  _getExpandableProviders: function(accounts) {
    var providers = [];
    Object.keys(accounts).forEach(key => {
      var account = accounts[key];
      var provider = providerFactory.get(account.providerType);
      if (provider &&
          provider.canExpandRecurringEvents &&
          providers.indexOf(provider) === -1) {
        providers.push(provider);
      }
    });

    return providers;
  }
};

});
