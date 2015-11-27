/* global define */
(function(exports) {
  'use strict';

  var elementKeyMap = {
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
        }
      },
      attributes: {
        'role': {
          'gridcell': {
            keys: {lsk: 'add-event', dpe: 'view', rsk: 'option'}
          }
        }
      }
    }
  };

  function cloneKey(keys) {
    var newKeys = {};
    for (var key in keys) {
      newKeys[key] = keys[key];
    }
    return newKeys;
  }

  function extendKey(resultKeys, keys) {
    if (!keys) {
      return resultKeys;
    }
    for (var key in keys) {
      resultKeys[key] = keys[key];
    }
    return resultKeys;
  }

  function getKeyMaps(elem) {
    var tagNameKeys = matchKeys(
      elem,
      elementKeyMap[elem.tagName.toLowerCase()],
      {
        level: 0
      }, 0
    );

    var generalKeys = matchKeys(elem, elementKeyMap['*'], {
      level: 0
    }, 0);

    var resultKey =
      (generalKeys.level > tagNameKeys.level) ? generalKeys : tagNameKeys;
    delete resultKey.level;

    return resultKey;
  }

  function matchKeys(elem, map, keys, level) {
    if (!map) {
      return keys;
    }
    keys.level = keys.level || 0;
    keys.level += level;

    var newKeys = extendKey(keys, map.keys);
    var resultKeys = cloneKey(newKeys);

    var classKeys;
    var classes = map.classes || {};
    for (var className in classes) {
      if (elem.classList.contains(className)) {
        classKeys = matchKeys(elem, classes[className], cloneKey(newKeys), 1);
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
        attrKeys = matchKeys(
          elem,
          attributes[attributeName][attrValue],
          cloneKey(newKeys), 2
        );
        if (attrKeys.level >= resultKeys.level) {
          resultKeys = attrKeys;
        }
      } else if (elem.hasAttribute(attributeName) &&
                 attributes[attributeName]['*']) {
        attrKeys = matchKeys(
          elem,
          attributes[attributeName]['*'],
          cloneKey(newKeys), 2
        );
        if (attrKeys.level >= resultKeys.level) {
          resultKeys = attrKeys;
        }
      }
    }

    return resultKeys;
  }

  exports.ElementSoftkeysMap = {
    getKeyMaps: getKeyMaps
  };
})(window);
