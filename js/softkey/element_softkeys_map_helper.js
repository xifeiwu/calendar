(function(exports) {
  'use strict';

  var elementKetMap = {
    'li': {
      keys: {},
      classes: {
        'sk-advs-setup-calendar': {
          keys: {lsk: 'back', dpe: 'select'}
        },
        'sk-advs-sync-frequency': {
          keys: {lsk: 'back', dpe: 'select'}
        },
        'sk-advs-setting-default': {
          keys: {lsk: 'back', dpe: 'select'}
        },
        'sk-advs-event-alarm': {
          keys: {lsk: 'back', dpe: 'select'}
        },
        'sk-advs-allday-alarm': {
          keys: {lsk: 'back', dpe: 'select'}
        },
        'sk-modify-event-calendar-id': {
          keys: {lsk: 'cancel', dpe: 'select', rsk: 'save'}
        },
        'sk-modify-event-current-calendar': {
          keys: {lsk: 'cancel', dpe: 'select', rsk: 'save'}
        },
        'sk-modify-event-remind-me': {
          keys: {lsk: 'cancel', dpe: 'select', rsk: 'save'}
        },
        'sk-modify-event-note': {
          keys: {lsk: 'cancel', dpe: 'select', rsk: 'save'}
        },
        'sk-modify-event-repeat': {
          keys: {lsk: 'cancel', dpe: 'select', rsk: 'save'}
        },
        'sk-events-list-item': {
          keys: {lsk: 'back', dpe: 'view', rsk: 'option'}
        },
        'sk-events-list-item-online': {
          keys: {lsk: 'back', dpe: 'view'}
        }
      },
      attributes: {
        'role': {
          'gridcell': {
            keys: {lsk: 'add-event', dpe: 'view', rsk: 'option'}
          },
          'gridcell-no-events': {
            keys: {lsk: 'add-event', rsk: 'option'}
          }
        }
      }
    },
    'h5-input-wrapper': {
      keys: {dpe: 'select'},
      classes: {
        'sk-modify-event-title': {
          keys: {lsk: 'cancel', dpe: 'select', rsk: 'save'}
        },
        'sk-modify-event-location': {
          keys: {lsk: 'cancel', dpe: 'select', rsk: 'save'}
        },
        'sk-modify-event-start-date': {
          keys: {lsk: 'cancel', dpe: 'select', rsk: 'save'}
        },
        'sk-modify-event-start-time': {
          keys: {lsk: 'cancel', dpe: 'select', rsk: 'save'}
        },
        'sk-modify-event-end-date': {
          keys: {lsk: 'cancel', dpe: 'select', rsk: 'save'}
        },
        'sk-modify-event-end-time': {
          keys: {lsk: 'cancel', dpe: 'select', rsk: 'save'}
        }
      }
    },
    'h5-checkbox': {
      classes: {
        'sk-modify-event-all-day': {
          keys: {lsk: 'cancel', rsk: 'save'}
        }
      }
    },
    'h5-list-button': {
      classes: {
        'sk-add-account': {
          keys: {lsk: 'back', dpe: 'select'}
        }
      }
    }
  };

  var ElementSoftkeysMap = function() {
    this.elementKetMap = elementKetMap;
  };

  ElementSoftkeysMap.prototype.cloneKey = function esm_cloneKey(keys) {
    var newKeys = {};
    for (var key in keys) {
      newKeys[key] = keys[key];
    }
    return newKeys;
  };

  ElementSoftkeysMap.prototype.extendKey =
    function esm_extendKey(resultKeys, keys) {
      if (!keys) {
        return resultKeys;
      }
      for (var key in keys) {
        resultKeys[key] = keys[key];
      }
      return resultKeys;
    };

  ElementSoftkeysMap.prototype.getKeyMaps = function esm_getKeyMaps(elem) {
    var tagNameKeys = this.matchKeys(
      elem,
      this.elementKetMap[elem.tagName.toLowerCase()],
      {
        level: 0
      }, 0
    );

    var generalKeys = this.matchKeys(elem, this.elementKetMap['*'], {
      level: 0
    }, 0);

    var resultKey =
      (generalKeys.level > tagNameKeys.level) ? generalKeys : tagNameKeys;
    delete resultKey.level;

    return resultKey;
  };

  ElementSoftkeysMap.prototype.matchKeys =
    function esm_matchKeys(elem, map, keys, level) {
      if (!map) {
        return keys;
      }
      keys.level = keys.level || 0;
      keys.level += level;

      var newKeys = this.extendKey(keys, map.keys);
      var resultKeys = this.cloneKey(newKeys);

      var classKeys;
      var classes = map.classes || {};
      for (var className in classes) {
        if (elem.classList.contains(className)) {
          classKeys =
            this.matchKeys(elem, classes[className], this.cloneKey(newKeys), 1);
          if (classKeys.level >= resultKeys.level) {
            resultKeys = classKeys;
          }
        }
      }

      var attrKeys;
      var attributes = map.attributes || {};
      for (var attributeName in attributes) {
        var attrValue = elem.getAttribute(attributeName);

        if (attrValue && attributes[attributeName][attrValue]) {
          attrKeys = this.matchKeys(
            elem,
            attributes[attributeName][attrValue],
            this.cloneKey(newKeys), 2
          );
          if (attrKeys.level >= resultKeys.level) {
            resultKeys = attrKeys;
          }
        } else if (elem.hasAttribute(attributeName) &&
                   attributes[attributeName]['*']) {
          attrKeys = this.matchKeys(
            elem,
            attributes[attributeName]['*'],
            this.cloneKey(newKeys), 2
          );
          if (attrKeys.level >= resultKeys.level) {
            resultKeys = attrKeys;
          }
        }
      }

      return resultKeys;
    };

  exports.elementSoftkeysMap = new ElementSoftkeysMap();
})(window);
