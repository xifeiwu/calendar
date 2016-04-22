define(function(require, exports, module) {
'use strict';

function OptimizeRecurring(forDebug) {
  this.forDebug = forDebug;
  this.debug = forDebug.debug;

  if (forDebug.app.dayObserver) {
    this.dayObserver = forDebug.app.dayObserver;
  }
}
module.exports = OptimizeRecurring;

OptimizeRecurring.prototype = {
  showDayObserver: function() {
    if (!this.dayObserver) {
      return this.debug('this.dayObserver is undefined.')
    }
    if (this.dayObserver.busytimes) {
      var busytimes = this.dayObserver.busytimes;
      // for (var key of busytimes.keys()) {
      //   this.debug(busytimes.get(key));
      // }
      this.debug('size of busytimes: ' + busytimes.size);
    }
    if (this.dayObserver.cachedSpans) {
      var cachedSpans = this.dayObserver.cachedSpans;
      this.debug('size of cachedSpans: ' + cachedSpans.length);
      this.dayObserver.cachedSpans.forEach(span => {
        this.debug('start: ' + this.toLocalTime(new Date(span.start)));
        this.debug('end: ' + this.toLocalTime(new Date(span.end)));
      });
    }
    if (this.dayObserver.eventsToBusytimes) {
      var eventsToBusytimes = this.dayObserver.eventsToBusytimes;
      for (var key of eventsToBusytimes.keys()) {
        this.debug(key + ': ');
        this.debug(eventsToBusytimes.get(key));
      }
      this.debug('size of eventsToBusytimes: ' + eventsToBusytimes.size);
    }
  },

  toLocalTime: function(date) {
    return date.toLocaleFormat('%Y-%m-%dT%H:%M:%S');
  },
};

});
