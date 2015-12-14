define(function(require, exports, module) {
'use strict';

var denodeifyAll = require('promise').denodeifyAll;
var providerFactory = require('provider/provider_factory');

function DeleteController(app) {
  this.app = app;
  this.events = this.app.store('Event');
  this.busytimes = this.app.store('Busytime');

  denodeifyAll(this, [
    'deleteLocalEvent',
    'deleteLocalRecurringEvent',
    'deleteLocalBusytime',
    'deleteEvent'
  ]);
}
module.exports = DeleteController;

DeleteController.prototype = {
  /*
   * delete event
   */
  deleteEvent: function(event, callback) {
    this.events.ownersOf(event, function (err, owners) {
      if (err) {
        callback(err);
        return;
      }

      var provider = providerFactory.get(owners.account.providerType);
      provider.eventCapabilities(event, function (err, caps) {
        if (err) {
          callback(err);
          return;
        }

        if (caps.canDelete) {
          provider.deleteEvent(event, function(err) {
            if (err) {
              callback(err);
            } else {
              callback(null, event);
            }
          });
        } else {
          callback('No delete capability');
        }
      });
    });
  },

  /*
   * delete local event and all dependencies
   */
  deleteLocalEvent: function(event, callback) {
    this._ensureLocalProvider(event, function(err, localProvider) {
      if (err) {
        callback(err);
        return;
      }

      localProvider.deleteEvent(event, function(err) {
        if (err) {
          callback(err);
        } else {
          callback(null, event);
        }
      });
    });
  },

  /*
   * delete local recurring event and all dependencies
   */
  deleteLocalRecurringEvent: function(event, callback) {
    if (!event.remote.isRecurring) {
      callback('Not recurring event');
    } else {
      this.deleteLocalEvent(event, callback);
    }
  },

  /*
   * delete the busytime item only
   */
  deleteLocalBusytime: function(event, busytimeId, callback) {
    this._ensureLocalProvider(event, function(err, localProvider) {
      if (err) {
        callback(err);
        return;
      }

      localProvider.deleteBusytime(busytimeId, function(err) {
        if (err) {
          callback(err);
        } else {
          callback(null, busytimeId);
        }
      });
    });
  },

  /*
   * To ensure the event passed in is belonging to
   * local provider and it can be deleted.
   */
  _ensureLocalProvider: function(event, callback) {
    this.events.ownersOf(event, function (err, owners) {
      if (err) {
        callback(err);
        return;
      }

      var providerType = owners.account.providerType;
      if (providerType === 'Local') {
        var provider = providerFactory.get(providerType);
        provider.eventCapabilities(event, function (err, caps) {
          if (err) {
            callback(err);
            return;
          }

          if (caps.canDelete) {
            callback(null, provider);
          } else {
            callback('No delete capability');
          }
        });
      } else {
        callback('Not local provider');
      }
    });
  }
};

});
