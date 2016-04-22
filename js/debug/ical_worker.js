define(function(require, exports, module) {
'use strict';

var Calc = require('calc');
var ICAL = require('ext/ical');

function ICALWorker(forDebug) {
  this.forDebug = forDebug;
  this.debug = forDebug.debug;
  this.app = forDebug.app;
}
module.exports = ICALWorker;

ICALWorker.prototype = {
  /**
   * show the use of iterator, minDate and maxDate.
   */
  expandIcalParameters: function(ical) {
    var iterator = {
      ruleIterators: [{
        initialized: true,
        rule: {
          freq: 'DAILY'
        },
        dtstart: {
          year: 2016,
          month: 1,
          day: 1,
          hour: 1,
          minute: 0,
          second: 0,
          isDate: false,
          timezone: 'Asia/Shanghai'
        },
        by_data: {
          BYSECOND: [0],
          BYMINUTE: [0],
          BYHOUR: [1]
        },
        days: [],
        last: {
          year: 2016,
          month: 1,
          day: 13,
          hour: 1,
          minute: 0,
          second: 0,
          isDate: false,
          timezone: 'Asia/Shanghai'
        },
        by_indices: {
          BYSECOND: 0,
          BYMINUTE: 0,
          BYHOUR: 0,
          BYDAY: 0,
          BYMONTH: 0,
          BYWEEKNO: 0,
          BYMONTHDAY: 0
        },
        occurrence_number: 13
      }],
      ruleDates: [],
      exDates: [],
      ruleDateInc: 0,
      exDateInc: 0,
      last: {
        year: 2016,
        month: 1,
        day: 12,
        hour: 1,
        minute: 0,
        second: 0,
        isDate: false,
        timezone: 'Asia/Shanghai'
      },
      dtstart: {
        year: 2016,
        month: 1,
        day: 1,
        hour: 1,
        minute: 0,
        second: 0,
        isDate: false,
        timezone: 'Asia/Shanghai'
      },
      complete: false
    };
    // var minDate = new ICAL.Time({
    //   year: 2016,
    //   month: 1,
    //   day: 1,
    //   hour: 1,
    //   minute: 0,
    //   second: 0,
    //   isDate: false,
    //   timezone: 'Asia/Shanghai',
    //   zone: new ICAL.Timezone({tzid: 'Asia/Shanghai'})
    // });
    var maxDate = new ICAL.Time();
    maxDate.fromUnixTime(new Date(2016, 1, 13, 1, 0, 0).getTime() / 1000);
    maxDate.zone = ICAL.Timezone.localTimezone;

    var options = {
      // iterator: iterator,
      maxDate: maxDate
    };
    this.expandRecurringEvent(
      ical, options,
      (err, iterator, lastRecurrence, uid) => {
        if (err) {
          return this.debug('error while expandRecurringEvent: ' + err);
        }
        console.log('The result:');
        console.log(JSON.stringify(iterator));
        console.log(lastRecurrence);
        console.log(uid);
      }
    );
  },

  unobserve: function() {
    this.app.timeController.removeEventListener(
      'monthChange',
      this
    );
  },

  observe: function() {
    this.app.timeController.on('monthChange', this);
  },

  handleEvent: function(event) {
    switch (event.type) {
      case 'monthChange':
        // this.expandEventByMonth(event.data[0]);

        var monthSpan = Calc.spanOfMonth(event.data[0]);
        console.log(monthSpan.toJSON());
        break;
    }
  },

  setIcal: function(ical) {
    this.ical = ical;
  },
  expandEventByMonth: function(date) {
    var monthSpan = Calc.spanOfMonth(date);

    var minDate = new ICAL.Time();
    minDate.fromUnixTime(monthSpan.start / 1000);
    minDate.zone = ICAL.Timezone.utcTimezone;
    var maxDate = new ICAL.Time();
    maxDate.fromUnixTime(monthSpan.end / 1000);
    maxDate.zone = ICAL.Timezone.utcTimezone;

    var options = {
      minDate: minDate,
      maxDate: maxDate
    };
    this.expandRecurringEvent(
      this.ical, options,
      (err, iterator, lastRecurrence, uid) => {
        if (err) {
          return this.debug('error while expandRecurringEvent: ' + err);
        }
        console.log('The result:');
        console.log(JSON.stringify(iterator));
        console.log(lastRecurrence);
        console.log(uid);
      }
    );

  },
  /**
   * Parse an ical data/string into primary
   * event and exceptions.
   *
   * It is assumed there is only one primary event
   * (does not have a RECURRENCE-ID) in the ical content.
   *
   * @param {Object|String|ICAL.Event} ical vcalendar chunk (and exceptions).
   * @param {Function} callback node style callback [err, primary event].
   */
  parseEvent: function(ical, callback) {
    if (ical instanceof ICAL.Event) {
      callback(null, ical);
      return;
    }

    var parser = new ICAL.ComponentParser();
    var primaryEvent;
    var exceptions = [];

    parser.ontimezone = function(zone) {
      var id = zone.tzid;

      if (!ICAL.TimezoneService.has(id)) {
        ICAL.TimezoneService.register(id, zone);
      }
    };

    parser.onevent = function(item) {
      if (item.isRecurrenceException()) {
        exceptions.push(item);
      } else {
        primaryEvent = item;
      }
    };

    parser.oncomplete = function() {
      if (!primaryEvent) {
        //TODO: in the error handling pass we need to define
        //     path to log this information so we can determine
        //     the cause of failures.
        callback(new Error('ical parse error'));
        return;
      }
      exceptions.forEach(primaryEvent.relateException, primaryEvent);
      callback(null, primaryEvent);
    };

    //XXX: Right now ICAL.js is all sync so we
    //     can catch the errors this way in the future
    //     onerror will replace this.
    try {
      parser.process(ical);
    } catch (e) {
      callback(e);
    }
  },

  /**
   * Options:
   *
   *  - iterator: (ICAL.RecurExpander) optional recurrence expander
   *              used to resume the iterator state for existing events.
   *
   *  - maxDate: if instance ends after this date stop expansion.
   *
   *
   * Returns:
   *
   *    [
   *      {
   *        start: { offset: inMS, utc: ms },
   *        endDate: // same format as start,
   *        recurrenceId: // id of specific recurrence.
   *        uid: // uid of event
   *        isException: // true when is exception to usual rule.
   *      },
   *      //...
   *    ]
   */
  expandRecurringEvent: function(component, options, callback) {
    var self = this;
    var maxDate;
    var minDate = null;
    var now;

    if (options.minDate) {
      minDate = this.formatInputTime(options.minDate);
    }

    if (options.maxDate) {
      maxDate = this.formatInputTime(options.maxDate);
    }

    if (!('now' in options)) {
      options.now = ICAL.Time.now();
    }

    now = options.now;

    // convert to rich ical event
    this.parseEvent(component, function(err, event) {
      if (err) {
        callback(err);
        return;
      }

      var iter = self.forEach(
        event,
        options.iterator,
        occuranceHandler,
        minDate,
        maxDate
      );

      function occuranceHandler(next) {
        var details = event.getOccurrenceDetails(next);
        if (details.endDate.zone.tzid !== now.zone.tzid) {
          if (details.endDate.zone.tzid ===
              ICAL.Timezone.localTimezone.tzid) {
            now = ICAL.Time.fromJSDate(new Date(), false);
          } else {
            now = ICAL.Time.fromJSDate(new Date(), true);
          }
        }
        var inFuture = details.endDate.compare(now);

        self.debug('alarm time',
              event.summary,
              'will add ' + String(inFuture),
              'start:', details.startDate.toJSDate().toString(),
              'end:', details.endDate.toJSDate().toString(),
              'now:', now.toJSDate().toString());

        var occurrence = {
          start: self.formatICALTime(details.startDate),
          end: self.formatICALTime(details.endDate),
          recurrenceId: self.formatICALTime(next),
          eventId: details.item.uid,
          isException: details.item.isRecurrenceException()
        };

        // only set alarms for those dates in the future...
        // if (inFuture >= 0) {
        //   var alarms = self._displayAlarms(details);
        //   if (alarms) {
        //     occurrence.alarms = alarms;
        //   }
        // }
        // stream.emit('occurrence', occurrence);
      }

      var lastRecurrence;

      if (iter.complete) {
        // when the iterator is complete
        // last recurrence is false.
        // We use this to signify the end
        // of the iteration cycle.
        lastRecurrence = false;
      } else {
        // its very important all times used
        // for comparison are based on the recurrence id
        // and not the start date as those can change
        // with exceptions...
        lastRecurrence = self.formatICALTime(
          iter.last
        );
      }

      callback(
        null,
        iter.toJSON(),
        lastRecurrence,
        event.uid
      );
    });
  },

  /**
   * Takes an ICAL.Time object and converts it
   * into the storage format familiar to the calendar app.
   *
   *    var time = new ICAL.Time({
   *      year: 2012,
   *      month: 1,
   *      day: 1,
   *      zone: 'PST'
   *    });
   *
   *    // time is converted to a MS
   *    // then its UTC offset is added
   *    // so the time is at UTC (offset 0) then the
   *    // offset is associated with that time.
   *
   *    var output = {
   *      utc: ms,
   *      offset: (+|-)ms,
   *      // zone can mostly be ignored except
   *      // in the case where the event is "floating"
   *      // in time and we need to convert the utc value
   *      // to the current local time.
   *      tzid: ''
   *    };
   */
  formatICALTime: function(time) {
    var zone = time.zone;
    var offset = time.utcOffset() * 1000;
    var utc = time.toUnixTime() * 1000;

    utc += offset;

    var result = {
      tzid: zone.tzid,
      // from seconds to ms
      offset: offset,
      // from seconds to ms
      utc: utc
    };

    if (time.isDate) {
      result.isDate = true;
    }

    return result;
  },

  /**
   * Formats a given time/date into a ICAL.Time instance.
   * Suitable for converting the output of formatICALTime back
   * into a similar representation of the original.
   *
   * Once a time instance goes through this method it should _not_
   * be modified as the DST information is lost (offset is preserved).
   *
   * @param {ICAL.Time|Object} time formatted ical time
   *                                    or output of formatICALTime.
   */
  formatInputTime: function(time) {
    if (time instanceof ICAL.Time) {
      return time;
    }

    var utc = time.utc;
    var tzid = time.tzid;
    var offset = time.offset;
    var result;

    if (tzid === ICAL.Timezone.localTimezone.tzid) {
      result = new ICAL.Time();
      result.fromUnixTime(utc / 1000);
      result.zone = ICAL.Timezone.localTimezone;
    } else {
      result = new ICAL.Time();
      result.fromUnixTime((utc - offset) / 1000);
      result.zone = ICAL.Timezone.utcTimezone;
    }

    if (time.isDate) {
      result.isDate = true;
    }

    return result;
  },

  /**
   * Maximum iterations must be > 0 && < Infinity.
   * Lower values are probably better as we can show progress
   * for multiple events rather then complete one long recurring
   * event after another...
   */
  forEachLimit: 200,

  _isDone: function(last, sent, max) {
    if (last && max && last.compare(max) >= 0) {
      return true;
    } else if (sent < this.forEachLimit) {
      return false;
    }

    return true;
  },

  /**
   * Iterates through a recur expansion instance.
   * Gracefully handles existing iterators (including failures).
   * Will fallback to complete re-expansion when necessary.
   *
   * NOTE: This method intentionally does not accept the "forEach"
   * function as the final argument to indicate it does not follow
   * the NodeJS example...
   *
   * minDate is always exclusive
   * maxDate is not strict and may include one occurrence beyond.
   *
   * @param {ICAL.Event} event complete event.
   * @param {Null|Object} iterator or nothing.
   * @param {Function} forEach receives [nextDate].
   * @param {ICAL.Time|Null} minDate minimum time (defaults to start).
   * @param {ICAL.Time|Null} maxDate maximum date (defaults to none).
   * @return {ICAL.RecurExpansion} iterator.
   */
  forEach: function(event, iterator, each, min, max) {
    // if there is no iterator create one...
    if (!iterator) {
      return this._beginIteration(event, each, min, max);
    }

    var iter;

    try {
      iter = this._resumeIteration(event, iterator, each, min, max);
    } catch (e) {
      console.error('Iteration Error: ' + e.toString());
      iter = this._beginIteration(event, each, min, max);
    }

    return iter;
  },

  _resumeIteration: function(event, iterator, each, min, max) {
    if (!(iterator instanceof ICAL.RecurExpansion)) {
      iterator = new ICAL.RecurExpansion(iterator);
    }

    this._iterate(event, iterator, each, min, max);
    return iterator;
  },

  _beginIteration: function(event, each, min, max) {
    var iterator = event.iterator();
    this._iterate(event, iterator, each, min, max);
    return iterator;
  },

  _iterate: function(event, iterator, each, min, max) {
    // keep track of the iterations
    var sent = 0;
    var current;

    do {
      current = iterator.next();

      if (!current || current.compare(max) > 0) {
        break;
      }

      if (!min || current.compare(min) >= 0) {
        // sent should be inside the loop to guard against
        // the possibility that the resume functionality breaking.
        sent++;
        each(current);
      }

    } while (!this._isDone(current, sent, max));
  }

};

});
