(function(exports) {
  'use strict';

  if (!window.elementSoftkeysMap) {
    console.error('Please import element_softkeys_map_helper.js first');
    return;
  }

  var CLICK_ANIMATION_DELAY = 350;

  var SoftkeyHandler = function() {

    this.isBodyLskPrevetDefault = false;

    // Change state of <li> element depends on it's children
    this.focusedLi = null;

    this.cachedSoftkey = null;

    this.softkeyMaps = new WeakMap();

    window.addEventListener('keydown', this);
    window.addEventListener('focus', this, true);
    window.addEventListener('blur', this, true);

    navigator.mozL10n.once(this.updateSoftkeys.bind(this));

    // Watch attribute change and make corresponding softkey change
    var observer = new MutationObserver((mutations) => {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes') {
          if (window.SoftKeysHelper &&
              mutation.target === document.activeElement) {
            this.updateSoftkeys();
          }
        }
      }, this);
    });

    observer.observe(document.body, {
      attributes: true,
      subtree: true
    });

    this.register(document.body, {
      // lsk: {
      //   name: 'back',
      //   action: () => { return !this.isBodyLskPrevetDefault; }
      // }
    });
    this.focusParentLi();
  };

  SoftkeyHandler.prototype.getSoftkeyHandler =
    function sh_getSoftkeyHandler(elem) {
      var handler = {};
      while(elem && (!handler.lsk || !handler.dpe || !handler.rsk)) {
        var elemHandler = this.softkeyMaps.get(elem) || {};
        handler.lsk = handler.lsk || elemHandler.lsk;
        handler.dpe = handler.dpe || elemHandler.dpe;
        handler.rsk = handler.rsk || elemHandler.rsk;
        elem = elem.parentElement;
      }
      return handler;
    };

  SoftkeyHandler.prototype.updateSoftkeys =
    function sh_updateSoftkeys() {
      if (navigator.mozL10n.readyState !== 'complete') {
        return;
      }

      var elem = document.activeElement;
      var handler = this.getSoftkeyHandler(elem);
      var fallbackMap = window.elementSoftkeysMap.getKeyMaps(elem);
      if (window.SoftKeysHelper) {
        var keys = {};
        for (var key in handler) {
          if (handler[key]) {
            keys[key] = this.localizeText(handler[key].name);
          } else if (fallbackMap) {
            keys[key] = this.localizeText(fallbackMap[key]);
          }
          if (keys[key] === null) {
            delete keys[key];
          }
        }
        window.SoftKeysHelper.updateKeys(keys);
      }
    };

  SoftkeyHandler.prototype.localizeText =
    function sh_localizeText(text) {
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
    };

  SoftkeyHandler.prototype.register =
    function sh_register(elem, opts) {
      if (!elem || !(elem instanceof HTMLElement)) {
        return;
      }
      var handler = this.softkeyMaps.get(elem) || {};
      opts = opts || {};
      handler.lsk = opts.lsk || handler.lsk;
      handler.dpe = opts.dpe || handler.dpe;
      handler.rsk = opts.rsk || handler.rsk;
      this.softkeyMaps.set(elem, handler);
      this.updateSoftkeys();
    };

  SoftkeyHandler.prototype.focusParentLi =
    function sh_focusParentLi() {
      var li = document.activeElement;
      while (li && li.tagName !== 'LI') {
        li = li.parentElement;
      }

      if (li) {
        li.setAttribute('focus', true);
        this.focusedLi = li;
      }
    };

  SoftkeyHandler.prototype.cacheSoftkey =
    function sh_cacheSoftkey() {
      this.cachedSoftkey = window.SoftKeysHelper.registeredKeys();
    };

  SoftkeyHandler.prototype.restoreCacheSoftkey =
    function sh_restoreCacheSoftkey(elem) {
      window.SoftKeysHelper.updateKeys(this.cachedSoftkey);
    };

  SoftkeyHandler.prototype.handleEvent = function sh_handleEvent(evt) {
    switch(evt.type) {
      case 'keydown':
        var elem = document.activeElement;
        var handler = this.getSoftkeyHandler(elem);
        switch(evt.key) {
          case 'AcaSoftRight':
            if (handler.rsk && handler.rsk.action) {
              if(!handler.rsk.action()) {
                evt.preventDefault();
              }
              evt.stopPropagation();
            }
            break;
          case 'AcaSoftLeft':
            if (handler.lsk && handler.lsk.action) {
              if (!handler.lsk.action()) {
                evt.preventDefault();
              }
              evt.stopPropagation();
            }
            break;
          case 'Enter':
            var notPreventDefault = false;
            if (handler.dpe && handler.dpe.action) {
              notPreventDefault = handler.dpe.action();
              evt.stopPropagation();
            } else if (!elem.hasAttribute('disabled') &&
                       (window.SoftKeysHelper &&
                        window.SoftKeysHelper.registeredKeys().dpe)) {
              if (this.focusedLi) {
                var currentFocus = document.activeElement;
                var currentLi = this.focusedLi;
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
              evt.stopPropagation();
            }
            // prevent click event for keydown + keyup
            if (!notPreventDefault) {
              evt.preventDefault();
            }
            break;
        }
        break;
      case 'focus':
        // Clear the last focus li if the blur event is not fired
        if (this.focusedLi) {
          this.focusedLi.removeAttribute('focus');
          this.focusedLi = null;
        }
        window.SoftKeysHelper.registerKeys({});
        this.focusParentLi();
        this.updateSoftkeys();
        break;
      case 'blur':
        if (this.focusedLi) {
          this.focusedLi.removeAttribute('focus');
          this.focusedLi = null;
        }
        window.SoftKeysHelper.registerKeys({});
        break;
    }
  };

  exports.softkeyHandler = new SoftkeyHandler();
})(window);
