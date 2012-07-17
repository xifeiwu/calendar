Calendar.App = (function(window) {

  /**
   * Focal point for state management
   * within calendar application.
   *
   * Contains tools for routing and central
   * location to reference database.
   */
  var App = {

    /**
     * Entry point for application
     * must be called at least once before
     * using other methods.
     */
    configure: function(db, router) {
      this.db = db;
      this.router = router;

      this._views = {};
      this._routeViewFn = {};

      this.timeController = new Calendar.Controllers.Time();
    },

    /**
     * Navigates app to a new location.
     *
     * @param {String} url new view url.
     */
    go: function(url) {
      this.router.show(url);
    },

    _init: function() {
      var self = this;
      /* HACKS */
      function setPath(data, next) {
        document.body.setAttribute('data-path', data.canonicalPath);
        next();
      }

      // quick hack for today button
      var today = document.querySelector('#view-selector .today');

      today.addEventListener('click', function() {
        self.view('Month').render();
        self.timeController.setSelectedDay(new Date());
      });


      function tempView(selector) {
        self._views[selector] = new Calendar.View(selector);
        return selector;
      }

      /* temp views */
      this.state('/day/', setPath, tempView('#day-view'));
      this.state('/week/', setPath, tempView('#week-view'));
      this.state('/add/', setPath, tempView('#add-event-view'));


      /* routes */

      this.state('/month/', setPath, 'Month', 'MonthsDay');
      this.modifier('/settings/', setPath, 'Settings', { clear: false });
      this.state('/advanced-settings/', setPath, 'AdvancedSettings');

      this.state('/select-preset/', setPath, 'CreateAccount');
      this.state('/create-account/:preset', setPath, 'ModifyAccount');
      this.state('/update-account/:id', setPath, 'ModifyAccount');

      // I am not sure where this logic really belongs...
      this.state('/remove-account/:id', function(data) {
        var store = self.store('Account');
        store.remove(data.params.id, function(id) {
          self.go('/advanced-settings/');
        });
      });

      // default view
      if (window.location.pathname === '/') {
        this.go('/month/');
      }

      var account = this.db.getStore('Account');

      // load the current set of accounts
      account.load(function(err, data) {
        // after finished start router.
        self.router.start();
        document.body.classList.remove('loading');
      });
    },

    /**
     * Primary code for app can go here.
     */
    init: function() {
      var self = this;
      var pending = 2;

      function next() {
        pending--;
        if (!pending) {
          complete();
        }
      }

      function complete() {
        self._init();
      }

      if (!this.db) {
        this.configure(
          new Calendar.Db('b2g-calendar'),
          new Calendar.Router(page)
        );
      }

      window.addEventListener('localized', function() {
        next();
      });

      this.db.open(function() {
        next();
      });
    },

    /**
     * Initializes a view and stores
     * a internal reference so when
     * view is called a second
     * time the same view is returned.
     *
     *    // for example if you have
     *    // a calendar view Foo
     *
     *    Calendar.Views.Foo = Klass;
     *
     *    var view = app.view('Foo');
     *    (view instanceof Calendar.Views.Foo) === true
     *
     * @param {String} name view name.
     */
    view: function(name) {

      if (!(name in this._views)) {
        this._views[name] = new Calendar.Views[name]({
          app: this
        });
      }

      return this._views[name];
    },

    /**
     * Re-usable (via bind) function
     * to create view callbacks.
     */
    _routeCallback: function(object, ctx, next) {

      if (typeof(object) === 'string') {
        object = this.view(object);
      }

      this.router.mangeObject(object, ctx);
      next();
    },

    /**
     * Pure convenience function for
     * referencing a object store.
     *
     * @param {String} name store name. (e.g events).
     * @return {Calendar.Store.Abstact} store.
     */
    store: function(name) {
      return this.db.getStore(name);
    },

    /**
     * Wraps a view object in a function
     * so it can be used with a router.
     *
     * Caches results so to not create
     * duplicate functions.
     */
    _wrapViewObject: function(name) {
      var self = this;

      if (!(name in this._routeViewFn)) {
        var routeViewCallback = this._routeCallback.bind(this, name);
        this._routeViewFn[name] = routeViewCallback;
      }

      return this._routeViewFn[name];
    },

    _mapRoutes: function(args) {
      args = Array.prototype.slice.call(args);

      var path = args.shift();
      var self = this;

      var list = args.map(function(value) {
        var type = typeof(value);

        if (type === 'string') {
          return self._wrapViewObject(value);
        } else if (type === 'object') {
          return self._routeCallback.bind(self, value);
        }
        return value;
      });

      list.unshift(path);

      return list;
    },

    state: function() {
      this.router.state.apply(
        this.router,
        this._mapRoutes(arguments)
      );
    },

    modifier: function() {
      this.router.modifier.apply(
        this.router,
        this._mapRoutes(arguments)
      );
    }
  };

  return App;

}(this));
