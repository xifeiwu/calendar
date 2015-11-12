/* global LazyLoader, NavigationMap */
define(function(require, exports, module) {
  'use strict';
  var debug = require('debug')('navigation_handle');
  var NavigationMap = require('navigation_map');

  var NavigationHandler = {
    start: function _start() {
      NavigationMap.init();
      if (NavigationMap.scrollVar !== undefined) {
        scrollVar = NavigationMap.scrollVar;
      }
    },
    getCurItem: function _getCurItem() {
      return NavigationMap.getCurItem();
    }
  }
  module.exports = NavigationHandler;

  window.addEventListener('keydown', function(evt) {
    handleKeydown(evt);
  });
  var scrollVar = {
    block: 'start',
    behavior: 'smooth'
  };

  function handleKeydown(evt) {
    var el = evt.target, bestElementToFocus;
    debug('handleKeydown, ' + evt.target.id + ': ' + evt.key);
    if (NavigationMap && NavigationMap.currentActivatedLength > 0) {
      return;
    }
    if (document.activeElement.type === 'select-one') {
      return;
    }
    if (evt.key === 'Enter' || evt.key === 'Accept') {
      handleClick(evt);
    } else {
      if (!evt.target.classList) {
        debug('Warning: evt.target.classList does not exist.');
        return;
      }
      if (!evt.target.classList.contains('focus')) {
        debug('Warning: evt.target does not have focus');
        el = document.querySelector('.focus');
      }
      bestElementToFocus = findElementFromNavProp(el, evt);
      if (bestElementToFocus != null) {
        debug('handleKeydown, bestElementToFocus.id: ' + bestElementToFocus.id);
        var prevFocused = document.querySelectorAll('.focus');
        if (bestElementToFocus == prevFocused[0]) {
          return;
        }
        if (prevFocused.length > 0) {
          prevFocused[0].classList.remove('focus');
        }
        if (NavigationMap.scrollToElement === undefined) {
          bestElementToFocus.scrollIntoView(scrollVar);
        } else {
          NavigationMap.scrollToElement(bestElementToFocus, evt);
        }
        bestElementToFocus.classList.add('focus');
        bestElementToFocus.focus();
        document.dispatchEvent(new CustomEvent('focusChanged', {
          detail: {
            focusedElement: bestElementToFocus
          }
        }));
      }
    }
  }

  function findElementFromNavProp(currentlyFocused, evt) {
    var elementID;
    if (currentlyFocused == null) {
      return null;
    }
    var elmStyle = currentlyFocused.style;
    var handled = false;
    switch (evt.key) {
      case 'ArrowLeft':
        elementID = elmStyle.getPropertyValue('--nav-left');
        handled = true;
        break;
      case 'ArrowRight':
        elementID = elmStyle.getPropertyValue('--nav-right');
        handled = true;
        break;
      case 'ArrowUp':
        elementID = elmStyle.getPropertyValue('--nav-up');
        handled = true;
        break;
      case 'ArrowDown':
        elementID = elmStyle.getPropertyValue('--nav-down');
        handled = true;
        break;
      case 'Home':
      case 'MozHomeScreen':
        elementID = elmStyle.getPropertyValue('--nav-home');
        handled = true;
        break;
    }
    if (!elementID) {
      return null;
    }
    if (handled) {
      evt.preventDefault();
    }
    var selector = '[data-nav-id=\'' + elementID + '\']';
    return document.querySelector(selector);
  }

  function handleClick(evt) {
    if (NavigationMap !== undefined &&
        NavigationMap.handleClick !== undefined) {
      //costimization of click action.
      NavigationMap.handleClick(evt);
    } else {
      evt.target.click();
      for (var i = 0; i < evt.target.children.length; i++) {
        evt.target.children[i].click();
      }
    }
  }
});
