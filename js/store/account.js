(function(window) {

  function Account() {
    Calendar.Store.Abstract.apply(this, arguments);

    this._accounts = {};
  }

  Account.prototype = {
    __proto__: Calendar.Store.Abstract.prototype,

    _hydrate: function(obj, id) {
      if (!(obj instanceof Calendar.Models.Account)) {
        obj = new Calendar.Models.Account(obj);
      }

      if (typeof(id) !== 'undefined') {
        obj._id = id;
      }

      return obj;
    },

    /**
     * Returns a single instance of an account by id.
     *
     * @param {String} id uuid for account.
     * @param {Function} callback node style callback.
     */
    get: function(id, callback) {
      var result;

      if (id in this._accounts) {
        return callback(null, this._accounts[id]);
      }

      var self = this;
      var trans = this.db.transaction('accounts');
      var store = trans.objectStore('accounts');

      var req = store.get(id);

      req.onsuccess = function() {
        if (req.result) {
          result = self._hydrate(req.result, id);
        }
      }

      trans.onerror = function(err) {
        callback(err);
      }

      trans.oncomplete = function() {
        self._accounts[id] = result;
        callback(null, result);
      }
    },

    /**
     * Adds an account to the database.
     *
     * @param {Object} object reference to account object to store.
     * @param {Function} callback node style callback.
     */
    persist: function(object, callback) {
      var self = this;
      var trans = this.db.transaction('accounts', 'readwrite');
      var store = trans.objectStore('accounts');
      var data = this._objectData(object);
      var id;

      var putReq = store.put(data);

      trans.onerror = function() {
        callback(err);
      }

      trans.oncomplete = function(data) {
        var id = putReq.result;
        var result = self._hydrate(object, id);

        self._accounts[id] = result;
        callback(null, id, result);

        if (object._id) {
          self.emit('update', id, result);
        } else {
          self.emit('add', id, result);
        }

        self.emit('persist', id, result);
      };
    },

    all: function(callback) {
      var value;
      var self = this;
      var trans = this.db.transaction('accounts', 'readwrite');
      var store = trans.objectStore('accounts');
      var results = {};

      store.openCursor().onsuccess = function(event) {
        var cursor = event.target.result;

        if (cursor) {
          var object = self._hydrate(cursor.value, cursor.key);
          results[cursor.key] = object;
          self._accounts[cursor.key] = object;
          cursor.continue();
        }
      };

      trans.onerror = function(event) {
        callback(event);
      }

      trans.oncomplete = function() {
        callback(null, results);
      };
    },

    /**
     * Removes a object from the store.
     *
     * @param {String} id record reference.
     * @param {Function} callback node style callback.
     */
    remove: function(id, callback) {
      var self = this;
      var trans = this.db.transaction('accounts', 'readwrite');
      var store = trans.objectStore('accounts');

      var req = store.delete(id);

      trans.onerror = function(event) {
        callback(event);
      }

      trans.oncomplete = function() {
        delete self._accounts[id];
        callback(null);
        self.emit('remove', id);
      }
    }

  };

  Calendar.ns('Store').Account = Account;

}(this));
