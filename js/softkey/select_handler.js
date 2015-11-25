/* global define */

define(function() {
'use strict';

var CLICK_ANIMATION_DURATION = 350;

/**
 * Handle special case for <select> element. Same as every app.
 */
var selectElement = {
  'SELECT': ['*'],
  'INPUT': ['date', 'time']
};

function isSelectElement(elem) {
  for (var tagName in selectElement) {
    for (var i = 0; i < selectElement[tagName].length; i++) {
      if (tagName === elem.tagName &&
          (selectElement[tagName][i] === '*' ||
           selectElement[tagName][i] === elem.getAttribute('type'))) {
        return true;
      }
    }
  }
  return false;
}

function getSelectElement(container) {
  var target;
  var selector;
  for (var tagName in selectElement) {
    for (var i = 0; i < selectElement[tagName].length; i++) {
      var type = selectElement[tagName][i];
      selector = tagName.toLowerCase();
      if (type !== '*') {
        selector += '[type="';
        selector += type;
        selector += '"]';
      }
      target = container.querySelector(selector);
      if (target) {
        return target;
      }
    }
  }

  return target;
}

window.addEventListener('keydown', function onSelectClick(evt) {
  var elem = evt.target;
  if (evt.keyCode === KeyEvent.DOM_VK_RETURN &&
      elem instanceof HTMLElement &&
      elem.classList.contains('pack-select') &&
      !elem.hasAttribute('disabled')) {
    var selectElem = getSelectElement(evt.target);
    if (selectElem) {
      var event = new CustomEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      selectElem.dispatchEvent(event);
      if (!event.defaultPrevented) {
        var currentFocus = document.activeElement;
        elem.setAttribute('pressing', '');
        setTimeout(function() {
          elem.removeAttribute('pressing');
          selectElem.focus();
        }, CLICK_ANIMATION_DURATION);
      }
    }
  }
}, true);

window.addEventListener('blur', function onBlur(evt) {
  var elem = evt.target;
  if (isSelectElement(elem)) {
    while(elem && !elem.classList.contains('pack-select')) {
      elem = elem.parentElement;
    }
    if (elem) {
      setTimeout(function() {
        elem.focus();
      });
    }
  }
}, true);

var observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    var elem = mutation.target;
    var parentLi = elem.parentElement;
    while (parentLi && parentLi.tagName !== 'LI') {
      parentLi = parentLi.parentElement;
    }
    if (parentLi) {
      if (elem.hasAttribute('disabled')) {
        parentLi.setAttribute('disabled', '');
      } else {
        parentLi.removeAttribute('disabled');
      }
    }
  });
}.bind(this));

observer.observe(document.body, {
  attributes: true,
  subtree: true,
  attributeFilter: ['disabled']
});

});
