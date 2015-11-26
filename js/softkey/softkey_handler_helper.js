/* global define */
(function(exports) {
  'use strict';

  if (!window.ElementSoftkeysMap) {
    console.error('Please import element_softkeys_map_helper.js first');
    return;
  }

  /**
   * Change state of <li> element depends on it's children
   */
  var focusedLi;

  var cachedSoftkey;

  var softkeyMaps = new WeakMap();

  var CLICK_ANIMATION_DELAY = 350;

  function getSoftkeyHandler(elem) {
    var handler = {};
    while(elem && (!handler.lsk || !handler.dpe || !handler.rsk)) {
      var elemHandler = softkeyMaps.get(elem) || {};
      handler.lsk = handler.lsk || elemHandler.lsk;
      handler.dpe = handler.dpe || elemHandler.dpe;
      handler.rsk = handler.rsk || elemHandler.rsk;
      elem = elem.parentElement;
    }
    return handler;
  }

  function updateSoftkeys() {
    if (document.activeElement === document.body) {
      return;
    }

    var elem = document.activeElement;
    var handler = getSoftkeyHandler(elem);
    var fallbackMap = window.ElementSoftkeysMap.getKeyMaps(elem);
    if (window.SoftKeysHelper) {
      var keys = {};
      for (var key in handler) {
        if (handler[key]) {
          keys[key] = localizeText(handler[key].name);
        } else if (fallbackMap) {
          keys[key] = localizeText(fallbackMap[key]);
        }
        if (keys[key] === null) {
          delete keys[key];
        }
      }
      SoftKeysHelper.updateKeys(keys);
    }
  }

  function register(elem, opts) {
    if (!elem || !(elem instanceof HTMLElement)) {
      return;
    }
    var handler = softkeyMaps.get(elem) || {};
    opts = opts || {};
    handler.lsk = opts.lsk || handler.lsk;
    handler.dpe = opts.dpe || handler.dpe;
    handler.rsk = opts.rsk || handler.rsk;
    softkeyMaps.set(elem, handler);
    updateSoftkeys();
  }

  function localizeText(text) {
    if (text === '') {
      return '';
    }
    if (!text) {
      return null;
    }
    if (typeof text === 'string') {
      return navigator.mozL10n.get(text);
    } else if (typeof text === 'object') {
      return navigator.mozL10n.get(text.id, text.args);
    }
  }

  function focusParentLi() {
    var elem = document.activeElement;
    var li = elem;
    while (li && li.tagName !== 'LI') {
      li = li.parentElement;
    }

    if (li) {
      li.setAttribute('focus', true);
      focusedLi = li;
    }
  }

  function cacheSoftkey() {
    cachedSoftkey = SoftKeysHelper.registeredKeys();
  }

  function restoreCacheSoftkey() {
    SoftKeysHelper.updateKeys(cachedSoftkey);
  }

  function handleEvent(evt) {
    switch(evt.type) {
      case 'keydown':
        if (!(evt.key === 'AcaSoftRight' ||
            evt.key === 'AcaSoftLeft' ||
            evt.keyCode === KeyEvent.DOM_VK_ACCEPT ||
            evt.keyCode === KeyEvent.DOM_VK_ESCAPE ||
            evt.keyCode === KeyEvent.DOM_VK_RETURN)) {
          return;
        }

        var elem = document.activeElement;
        var handler = getSoftkeyHandler(elem);
        if (evt.key === 'AcaSoftRight' ||
            evt.keyCode === KeyEvent.DOM_VK_ACCEPT) {
          if (handler.rsk && handler.rsk.action) {
            handler.rsk.action();
            evt.stopPropagation();
            evt.preventDefault();
          }
        } else if (evt.key === 'AcaSoftLeft' ||
                   evt.keyCode === KeyEvent.DOM_VK_ESCAPE) {
          if (handler.lsk && handler.lsk.action) {
            handler.lsk.action();
            evt.stopPropagation();
            evt.preventDefault();
          }
        } else if (evt.keyCode === KeyEvent.DOM_VK_RETURN) {
          if (handler.dpe && handler.dpe.action) {
            handler.dpe.action();
            evt.stopPropagation();
          } else if (!elem.hasAttribute('disabled') &&
                     (window.SoftKeysHelper &&
                      SoftKeysHelper.registeredKeys().dpe)) {
            if (focusedLi) {
              var currentFocus = document.activeElement;
              var currentLi = focusedLi;
              currentLi.setAttribute('pressing', '');
              setTimeout(function() {
                currentLi.removeAttribute('pressing');
                setTimeout(() => {
                  currentFocus.click();
                });
              }, CLICK_ANIMATION_DELAY);
            } else {
              document.activeElement.click();
            }
            evt.preventDefault();
          }
        }
        break;
      case 'focus':
        // Clear the last focus li if the blur event is not fired
        if (focusedLi) {
          focusedLi.removeAttribute('focus');
          focusedLi = null;
        }
        SoftKeysHelper.registerKeys({});

        focusParentLi();
        updateSoftkeys();
        break;
      case 'blur':
        if (focusedLi) {
          focusedLi.removeAttribute('focus');
          focusedLi = null;
        }
        SoftKeysHelper.registerKeys({});
        break;
    }
  }

  (function initSoftkeyHandler() {
    window.addEventListener('keydown', handleEvent);
    window.addEventListener('focus', handleEvent, true);
    window.addEventListener('blur', handleEvent, true);

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes') {
          if (window.SoftKeysHelper &&
              mutation.target === document.activeElement) {
            updateSoftkeys();
          }
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      subtree: true
    });

    register(document.body, {
    });
    focusParentLi();
  })();

  exports.SoftkeyHandler =  {
    register: register,
    cacheSoftkey: cacheSoftkey,
    restoreCacheSoftkey: restoreCacheSoftkey,
    get: function(elem) {
      return softkeyMaps.get(elem);
    }
  };
})(window);
