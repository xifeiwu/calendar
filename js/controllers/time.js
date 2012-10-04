Calendar.ns('Controllers').Time = (function() {

  function compareStart(a, b) {
    return Calendar.compare(a.start, b.start);
  }

  function Time(app) {
    this.app = app;
    Calendar.Responder.call(this);
    Calendar.TimeObserver.call(this);

    this._timeCache = {};
    this._timespans = [];
    this._collection = new Calendar.IntervalTree();

    var busytime = this.busytime = app.store('Busytime');

    busytime.on('add time', this);
    busytime.on('remove time', this);
  }

  Time.prototype = {
    __proto__: Calendar.Responder.prototype,

    /**
     * Current position in time.
     * Includes year, month and day.
     *
     * @type {Date}
     */
    _position: null,

    /**
     * Current center point of cached
     * time spans. This is not the last
     * loaded timespan but the last
     * requested timespan.
     *
     * @type {Calendar.Timespan}
     */
    _currentTimespan: null,

    /**
     * Hash that contains
     * the pieces of the current _position.
     * (month, day, year)
     */
    _timeCache: null,

    /**
     * Array of the currently cached
     * timespans. Should never be directly
     * referenced and it should be noted
     * that this array will be replaced
     * over time.
     *
     * @type {Array}
     */
    _timespans: null,

    /**
     * Maximum number of timespans
     * to keep cached over time.
     *
     * @type {Numeric}
     */
    _maxTimespans: 6,

    /**
     * Number of pending load operations.
     */
    pending: 0,

    /**
     * The time 'scale' of the current
     * state of the calendar.
     *
     * Usually one of: ['day', 'month', 'week']
     * @type {String}
     */
    _scale: null,

    /**
     * private state of mostRecentDayType
     */
    _mostRecentDayType: 'day',

    /**
     * Returns the most recently changed
     * day type either 'day' or 'selectedDay'
     */
    get mostRecentDayType() {
      return this._mostRecentDayType;
    },

    get timespan() {
      return this._timespan;
    },

    get scale() {
      return this._scale;
    },

    set scale(value) {
      var oldValue = this._scale;
      if (value !== oldValue) {
        this._scale = value;
        this.emit('scaleChange', value, oldValue);
      }
    },

    get selectedDay() {
      return this._selectedDay;
    },

    set selectedDay(value) {
      var day = this._selectedDay;
      this._mostRecentDayType = 'selectedDay';
      if (!day || !Calendar.Calc.isSameDate(day, value)) {
        this._selectedDay = value;
        this.emit('selectedDayChange', value, day);
      }
    },

    direction: 'future',

    observe: function() {
      this.on(
        'monthChange',
        this._loadMonthSpan.bind(this)
      );
    },

    /**
     * Helper function to 'move' state of calendar
     * to the most recently modified day type.
     *
     * (in the case where selectedDay was changed after day)
     */
    moveToMostRecentDay: function() {
      if (this.mostRecentDayType === 'selectedDay') {
        this.move(this.selectedDay);
      }
    },

    _updateCache: function(type, value) {
      var old = this._timeCache[type];

      if (!old || !Calendar.Calc.isSameDate(value, old)) {
        this._timeCache[type] = value;
        this.emit(type + 'Change', value, old);
      }
    },

    _updateBusytimeCache: function() {
      var dir = this.direction;
      var spans = this._timespans;
      var len = spans.length;
      var max = this._maxTimespans;

      if (len > max) {
        var idx = Calendar.binsearch.find(
          spans,
          this._currentTimespan,
          compareStart
        );

        var isFuture = (dir === 'future');
        var start = idx;

        // _maxTimespans is the total number of
        // timespans we wish to keep in memory
        // when the limit is hit we want to discard
        // extra but have _maxTimespans in length
        if (isFuture) {
          start = (idx - 1);
          if ((start + max) > len) {
            start = start - ((start + max) - len);
          }
        } else {
          start = (idx - max) + 1;
        }

        if (start < 0) {
          start = 0;
        }

        // reduce the current list to just what we need
        this._timespans = spans.splice(start, this._maxTimespans);

        // Once we have reduced the number of timespans
        // we also need purge unused busytimes from the cache.
        // Find the outer limits of the overal timespan
        // and purge anything that occurs before or after.
        //
        // NOTE: this will _not_ negatively effect long running
        // events we take care to only remove busytimes well before
        // or after the overall timespan.
        var startPoint = this._timespans[0].start;
        var endPoint = this._timespans[this._timespans.length - 1].end;

        this._collection.removePastIntervals(startPoint);
        this._collection.removeFutureIntervals(endPoint);

        spans.forEach(function(range) {
          // notify views that we have removed
          // these timespans. Views should remove
          // dom elements associated with these
          // ranges. Other controllers could possibly
          // listen to this event and do other kinds
          // of cleanup as well.
          this.emit(
            'purge', range
          );
        }, this);
      }
    },

    /**
     * When we are finished loading
     * emit the 'loadingComplete' event.
     */
    _onLoadingComplete: function() {
      if (!(--this.pending)) {
        // Keep the busytime cache healthy
        // and not too full or empty.
        // To avoid race conditions and
        // too frequent checking of the
        // status of the cache we only
        // do this when all loading is complete
        // and the user is not actively paging
        // through. This happens more often
        // then you might think as the
        // only reason we load a new span
        // is when we completely change
        // the month.
        this._updateBusytimeCache();
        this.emit('loadingComplete');
      }
    },

    _recordSpanChange: function(span) {
      var spans = this._timespans;
      var loadSpan = span;

      // Check if timespan already exists
      // every start time should be unique
      // so if we find another span with the
      // same start time it should cover
      // the same span.
      var idx = Calendar.binsearch.find(
        spans,
        span,
        compareStart
      );

      // if a perfect match is found stop,
      // we probably have loaded this span.
      if (idx !== null)
        return;

      // find best position for new span
      idx = Calendar.binsearch.insert(
        spans,
        span,
        compareStart
      );

      // insert it keep all spans ordered
      // by start time.
      spans.splice(idx, 0, span);

      // While we want to keep all a record of all
      // timespans in a uniform sorted manner we do
      // not want to load the same set of busytimes.
      // We trim the overlapping periods so to only
      // load what we need now.

      //NOTE: this trim logic will cause missed
      //events unless this is the sole method
      //of adding items to spans.

      // 1. lower bound trim
      if (spans[idx - 1]) {
        loadSpan = spans[idx - 1].trimOverlap(loadSpan);
      }

      // 2. upper bound trim
      if (spans[idx + 1]) {
        loadSpan = spans[idx + 1].trimOverlap(loadSpan);
      }

      // On the odd chance that one span
      // completely contains the other play
      // it safe and load it anyway.
      loadSpan = loadSpan || span;

      ++this.pending;

      // Actually request spans.
      this.busytime.loadSpan(
        loadSpan,
        this._onLoadingComplete.bind(this)
      );
    },

    /**
     * Loads the initial timespans
     * required for user to interact with
     * the calendar based on a start
     * date. This is called on the first
     * move of the calendar.
     *
     * Loads spans in the follow order:
     *
     * 1. current month
     * 2. next month
     * 3. past month
     *
     * @param {Date} date start point of busytimes to load.
     *                    Expected to be the first of a given
     *                    month.
     *
     * @param {Calendar.Timespan} presentSpan center point
     *                                        of timespan.
     */
    _loadAroundSpan: function(date, presentSpan) {
      var getSpan = Calendar.Calc.spanOfMonth;

      var pastSpan = getSpan(new Date(
        date.getFullYear(),
        date.getMonth() - 1,
        1
      ));

      var futureSpan = getSpan(
         new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          1
        )
      );

      // order is important
      // we want to load the busytimes
      // in order of importance to the users:
      // 1. current span.
      // 2. next span
      // 3. previous span.
      this._recordSpanChange(presentSpan);
      this._recordSpanChange(futureSpan);
      this._recordSpanChange(pastSpan);
    },

    /**
     * Loads a span of a month.
     * Each time this method is called
     * the same timespan will be generated.
     */
    _loadMonthSpan: function(date) {
      var len = this._timespans.length;

      var spanOfMonth = Calendar.Calc.spanOfMonth;
      this._currentTimespan = spanOfMonth(date);

      var currentIdx = Calendar.binsearch.find(
        this._timespans,
        this._currentTimespan,
        compareStart
      );

      // When given date's month span is not found
      // trigger a load of that span and the ones
      // around it.
      if (currentIdx === null) {
        return this._loadAroundSpan(date, this._currentTimespan);
      }

      // determine which direction we need load.
      var month = date.getMonth();
      var isFuture = this.direction === 'future';

      // Based on the direction we are
      // going we want to preload additional spans
      if (isFuture) {
        month += 1;
      } else {
        month -= 1;
      }

      var spans = this._timespans;
      var monthSpan = spanOfMonth(
        new Date(
          date.getFullYear(),
          month,
          1
        )
      );

      return this._recordSpanChange(monthSpan);
    },

    handleEvent: function(event) {
      var busytime = event.data[0];
      var start = busytime.startDate;
      var end = busytime.endDate;
      var type;

      switch (event.type) {
        case 'add time':
          type = 'add';
          this._collection.add(busytime);
          break;
        case 'remove time':
          type = 'remove';
          this._collection.remove(busytime);
          break;
      }

      if (type) {
        this.fireTimeEvent(
          type, start, end, busytime
        );
      }
    },

    get month() {
      return this._timeCache.month;
    },

    get day() {
      return this._timeCache.day;
    },

    get year() {
      return this._timeCache.year;
    },

    get position() {
      return this._position;
    },

    /**
     * Queries busytimes cache by timespan.
     *
     * @param {Calendar.Timespan} timespan query range.
     * @return {Array} busytimes ordered by start date.
     */
    queryCache: function(timespan) {
      return this._collection.query(timespan);
    },

    /**
     * Requests associated records for one or more busytimes.
     *
     * Options:
     *
     *  event: (Boolean) when true returns associated event. (default true).
     *  alarm: (Boolean) when true returns the associated alarm.
     *
     * Returns:
     *
     *    [
     *      { busytime: inputBusytime, event: event, alarm: alarm },
     *      ...
     *    ]
     *
     * @param {Array[Object]|Object} busytime one or more busytimes.
     * @param {Object} options see above.
     * @param {Function} cb node style [err, (see returns above)].
     */
    findAssociated: function(busytimes, options, cb) {
      if (typeof(options) === 'function') {
        cb = options;
        options = null;
      }

      var getEvent = true;
      var getAlarm = false;

      busytimes = (Array.isArray(busytimes)) ? busytimes : [busytimes];

      if (options && ('alarm' in options)) {
        getAlarm = options.alarm;
      }

      if (options && ('event' in options)) {
        getEvent = options.event;
      }

      var eventStore = this.app.store('Event');
      var alarmStore = this.app.store('Alarm');
      var list = [];

      var stores = [];

      if (getAlarm)
        stores.push('alarms');

      if (getEvent)
        stores.push('events');

      var trans = eventStore.db.transaction(stores);

      trans.addEventListener('error', cb);
      trans.addEventListener('complete', function() {
        cb(null, list);
      });

      // using forEach for scoping
      // XXX: this is a hot code path needs some optimization.
      busytimes.forEach(function(busytime, idx) {
        var result = { busytime: busytime };
        list[idx] = result;
        // XXX: we should probably cache events
        if (getEvent) {
          eventStore.get(busytime.eventId, trans, function(err, event) {
            if (event) {
              result.event = event;
            }
          });
        }

        if (getAlarm) {
          // its possible for more then one alarm to be present
          // for a given busytime. We are not supporting that right
          // now but in the future we may need to modify this to
          // return an array of alarms.
          alarmStore.findByBusytimeId(busytime._id, trans,
                                      function(err, alarm) {

            // unlike events we probably never want to cache alarms.
            if (alarm) {
              result.alarm = alarm;
            }
          });
        }
      }, this);
    },

    /**
     * Sets position of controller
     * in time.
     *
     * @param {Date} date position to move to.
     */
    move: function(date) {
      var year = date.getFullYear();
      var month = date.getMonth();
      var day = date.getDate();

      var yearDate = new Date(year, 0, 1);
      var monthDate = new Date(year, month, 1);

      var oldPosition = this._position;
      this._position = date;

      if (oldPosition) {
        if (oldPosition < date) {
          this.direction = 'future';
        } else if (oldPosition > date) {
          this.direction = 'past';
        } else {
          this.direction = 'future';
        }
      }

      this._mostRecentDayType = 'day';

      this._updateCache('year', yearDate);
      this._updateCache('month', monthDate);
      this._updateCache('day', date);

    }

  };

  Calendar.TimeObserver.enhance(Time.prototype);

  return Time;

}());
