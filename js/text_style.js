define(function() {
'use strict';

var TextStyle = {
  start: function() {
    // Set text style when first lanuch.
    this.setTextStyle(navigator.largeTextEnabled);
    window.addEventListener('largetextenabledchanged', this);
  },

  handleEvent: function(evt) {
    this.setTextStyle(navigator.largeTextEnabled);
  },

  setTextStyle: function(largeTextEnabled) {
    document.body.classList.toggle('large-text', largeTextEnabled);
  }
};
return TextStyle;

});
