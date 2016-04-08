define(function(require, exports, module) {
'use strict';

var router = require('router');

var TextStyle = {
  start: function() {
    // Set text style when first lanuch.
    this.setTextStyle(navigator.largeTextEnabled);
    window.addEventListener('largetextenabledchanged', this);
  },

  handleEvent: function(evt) {
    // If users are in event-list page while changing the font-size, whole page
    // is required to be reloaded since events' list are drew at the beginning
    // of loading this page and chaning the font-size may change the width.
    if (router.currentPath === '/event/list/') {
      router.go(router.currentPath);
    }
    this.setTextStyle(navigator.largeTextEnabled);
  },

  setTextStyle: function(largeTextEnabled) {
    document.body.classList.toggle('large-text', largeTextEnabled);
  }
};

module.exports = TextStyle;

});
