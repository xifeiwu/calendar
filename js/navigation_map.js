define(function(require, exports, module) {
  'use strict';

  const OPTION_MENU = 'option-menu';

  const MONTH_VIEW = 'month-view';
  const DAY_VIEW = 'day-view';
  const WEEK_VIEW = 'week-view';
  const MODIFY_EVENT = 'modify-event-view';
  const SETTING = 'advanced-settings-view';
  const SEARCH_VIEW = 'event-search-view';
  const CALENDAR_DISPLAY = 'settings';
  const SHOW_MULTI_EVENTS = 'multi-events-view';
  const CREATE_ACCOUNT = 'create-account-view';
  const MODIFY_ACCOUNT = 'modify-account-view';
  const SWITCHTO_DATE_VIEW = 'switchto-date-view';

  var Path_MAP = {
    'month-view': ['/month/'],
    'day-view': ['/day/'],
    'week-view': ['/week/'],
    'modify-event-view': ['/event/edit/', '/event/add/'],
    'advanced-settings-view': ['/advanced-settings/'],
    'event-search-view': ['/search/'],
    'settings': ['/settings/'],
    'multi-events-view': ['/show-multi-events/'],
    'create-account-view': ['/select-preset/'],
    'modify-account-view': ['/create-account/', '/update-account/'],
    'switchto-date-view': ['/switchto-date/']
  };

  var controls = {};
  var currentContainerID = null;

  var navId = 0;
  var _storeFocused = null;
  var multiReset = false;

  var DEBUG = true;

  function debug() {
    if (DEBUG) {
      var args = Array.prototype.slice.call(arguments).map(JSON.stringify);
      args.unshift('[calendar] ');
      args.unshift('navigation_map');
      console.log.apply(console, args);
    }
  }

  function setMultiReset(value) {
    multiReset = value;
  }

  function getMultiReset() {
    return multiReset;
  }

  function getIdByPath(path) {
    for (var id in Path_MAP) {
      var items = Path_MAP[id];
      for (var i = 0; i < items.length; i++) {
        if ((path == items[i]) || 
          (path.substring(0, items[i].length) == items[i])) {
            return id;
        }
      }
    }
  }

  function listViewUpdate(elements) {
    var i = 0;
    // to avoid 'data-nav-id' reproduced with grid
    var id = navId;

    for (i = 0; i < elements.length; i++) {
      elements[i].dataset.navId = id;
      //-1: invalid ID
      elements[i].style.setProperty('--nav-left', -1);
      elements[i].style.setProperty('--nav-right', -1);
      elements[i].style.setProperty('--nav-down', id + 1);
      elements[i].style.setProperty('--nav-up', id - 1);
      elements[i].setAttribute('tabindex', 0);
      id++;
    }

    //top element
    elements[0].style.setProperty('--nav-up', id - 1);
    //bottom element
    elements[elements.length - 1].style.setProperty('--nav-down', navId);
    navId = id;
  }

  function monthViewNavUpdate(elements) {
    var i = 0;
    // to avoid 'data-nav-id' reproduced with grid
    var id = navId;

    for (i = 0; i < elements.length; i++) {
      elements[i].dataset.navId = id;
      elements[i].style.setProperty('--nav-left', id - 1); //-1: invalid ID
      elements[i].style.setProperty('--nav-right', id + 1);
      elements[i].style.setProperty('--nav-down', id + 7);
      elements[i].style.setProperty('--nav-up', id - 7);
      elements[i].setAttribute('tabindex', 0);
      id++;
    }

    var lastDay;
    for (i = 0; i < 7; i++) {
      elements[i].style.setProperty('--nav-up', -1);
      elements[i].style.setProperty('--pre-month-7', true);
      lastDay = elements[elements.length - i - 1];
      lastDay.style.setProperty('--nav-down', -1);
      lastDay.style.setProperty('--next-month-7', true);
    }

    elements[0].style.setProperty('--nav-left', -1);
    elements[0].style.setProperty('--pre-month-1', true);
    elements[elements.length - 1].style.setProperty('--nav-right', -1);
    elements[elements.length - 1].style.setProperty('--next-month-1', true);

    navId = id;
  }

  function weekViewNavUpdate(elements) {
    var i = 0;
    // to avoid 'data-nav-id' reproduced with grid
    var id = navId;

    for (i = 0; i < elements.length; i++) {
      elements[i].dataset.navId = id;
      // -1: invalid ID
      elements[i].style.setProperty('--nav-left', id - 1);
      elements[i].style.setProperty('--nav-right', id + 1);
      elements[i].style.setProperty('--nav-down', id + 7);
      elements[i].style.setProperty('--nav-up', id - 7);
      elements[i].setAttribute('tabindex', 0);
      id++;
    }

    var sideElementsStyle = '#week-view .focusBox__weekAllDay,' +
                            ' #week-view .focusBox__weekDay';
    var sideElements = document.querySelectorAll(sideElementsStyle);
    for(var j = 0; j < sideElements.length; j++) {
      sideElements[j].firstChild.style.setProperty('--nav-left', -1);
      sideElements[j].firstChild.style.setProperty('--prev', true);
      sideElements[j].lastChild.style.setProperty('--nav-right', -1);
      sideElements[j].lastChild.style.setProperty('--next', true);
    }
    
    var lastDay;
    for (i = 0; i < 7; i++) {
      elements[i].style.setProperty('--nav-up',
                  Number(elements[i].dataset.navId) + 24 * 7);
      lastDay = elements[elements.length - i - 1];
      lastDay.style.setProperty('--nav-down',
                  Number(lastDay.dataset.navId) - 24 * 7);
    }
    navId = id;
  }

  function switchtoDateViewUpdate() {
    var i = 0;
    var id = navId;
    var elementsStyle = '#switchto-date-view .switchto-input-datetime';
    var elements = document.querySelectorAll(elementsStyle);
    for (i = 0; i < elements.length; i++) {
      elements[i].dataSet.navId = id;
      elements[i].style.setProperty('--nav-left', id - 1);
      elements[i].style.setProperty('--nav-right', id + 1);
      elements[i].style.setProperty('--nav-down', -1);
      elements[i].style.setProperty('--nav-up', -1);
      elements[i].setAttribute('tabindex', 0);
      id++;
    }

    //top element
    elements[0].style.setProperty('--nav-left', id - 1);
    //bottom element
    elements[elements.length-1].style.setProperty('--nav-right', navId);
    navId = id;
  }

  function getCurContainerId() {
    return currentContainerID;
  }

  function getCurControl() {
    var control = null;
    var containerId = getCurContainerId();

    if (containerId) {
      control = controls[containerId];
    }
    return control;
  }

  function getCurItem() {
    var item = null;
    var curControl = getCurControl();
    if (curControl) {
      if (curControl.index >= 0 &&
        curControl.index < curControl.elements.length) {
        item = curControl.elements[curControl.index];
      }
    }
    return item;
  }

  function sendIndexEvent(id, index, item) {
    var evt = new CustomEvent('index-changed', {
      detail: {
        panel: id,
        index: index,
        focusedItem: item
      },
      bubbles: true,
      cancelable: false
    });

    window.dispatchEvent(evt);
  }

  function setCurIndex(index) {
    var curControl = getCurControl();

    if (curControl) {
      if (index >= -1 && index < curControl.elements.length) {
        curControl.index = index;
        /* broadcoast change event */
        var focusedItem = (index == -1) ? null : curControl.elements[index];
        if (focusedItem) {
          _storeFocused = focusedItem;
        }
        sendIndexEvent(getCurContainerId(), index, focusedItem);
      }
    }
  }

  function dateFromId(id) {
    var parts = id.split('-'),
        date,
        type;
    if (parts.length > 1) {
      type = parts.shift();
      switch (type) {
        case 'd':
          date = new Date(parts[0], parts[1], parts[2]);
          break;
        case 'm':
          date = new Date(parts[0], parts[1]);
          break;
      }
    }

    return date;
  }

  var NavigationMap = {
    _customWeekFocus: {enable: false, type: ''},

    init: function _init() {
      debug('_init');

      document.addEventListener('focusChanged', function(e) {
        var focusedItem = e.detail.focusedElement;
        debug('focusChanged, ' + (focusedItem ? focusedItem.id : null));

        var curControl = getCurControl();
        if (curControl && curControl.elements) {
          /* convert to an array */
          var elements = Array.prototype.slice.call(curControl.elements);
          /* find the index of focused item in current control */
          var index = elements.indexOf(focusedItem);
          if (index >= 0) {
            /* update index */
            setCurIndex(index);
            debug('focusChanged, current index: ' + index);
          }
        }
      });

      document.addEventListener('h5os-date-changed', function(e) {
        debug('h5os-date-changed, e.detail.toDate: ' + e.detail.toDate);
        var todate = e.detail.toDate;
        this.navSetup(MONTH_VIEW, '.month.active .focusable');
        this.setFocusOnMonthView(todate);
      }.bind(this));

      document.addEventListener('h5os-week-custom-focus', function(e) {
        switch (e.detail.type) {
          case 'current-date':
            this.setCustomWeekFocus('current-date');
            break;
          case 'onactive':
            this._customWeekFocus.enable = true;
            this._customWeekFocus.type = 'onactive';
            this._customWeekFocus.targetDate = e.detail.targetDate;
            break;
        }
      }.bind(this));

      window.addEventListener('menuEvent', function(e) {
        debug('menuEvent: menuVisible = ' + e.detail.menuVisible);
        if (e.detail.menuVisible) {
          //assign id to option menu for navSetup
          e.detail.softkeyPanel.menu.form.id = OPTION_MENU;
          if (_storeFocused) {
            _storeFocused.classList.add('hasfocused');
            _storeFocused.classList.remove('focus');
          }
          setTimeout(() => {
            this.optionReset();
          }, 500);
        } else {
          if (_storeFocused) {
            _storeFocused.classList.remove('hasfocused');
            _storeFocused.classList.add('focus');
            _storeFocused.focus();
            window.focus();
          }
        }
      }.bind(this));
    },

    initMonthView: function() {
      currentContainerID = 'month-view';
      if (currentContainerID in controls) {
        return;
      }
      this.navSetup(currentContainerID, '.month.active .focusable');
      var currentDate = new Date();
      this.setFocusOnMonthView(currentDate);
    },

    setFocus: function _setFocus(id) {
      var curControl = getCurControl();
      if (!curControl) {
        debug('setFocus, failed!');
        return;
      }
      debug('setFocus, curIndex=' + curControl.index);
      debug('setFocus, length=' + curControl.elements.length);

      id = id || 0;
      id = (id == 'first') ? 0 :
          ((id == 'last') ? curControl.elements.length - 1 : id);

      if (id >= 0 && id < curControl.elements.length) {
        /* remove current focus, only one element has focus */
        var focused = document.querySelectorAll('.focus');
        for (var i = 0; i < focused.length; i++) {
          focused[i].classList.remove('focus');
        }

        focused = document.querySelectorAll('.hasfocused');
        for (i = 0; i < focused.length; i++) {
          focused[i].classList.remove('hasfocused');
        }

        var toFocused = curControl.elements[id];
        toFocused.setAttribute('tabindex', 1);
        toFocused.classList.add('focus');

        toFocused.focus();
        window.focus();
      }

      //id may be -1
      setCurIndex(id);
    },

    /**
     * setup navigation for the items that query from a container.
     * @param {String} the id of the container element.
     * undefined: coantainer = body
     * @param {String} the condition to query the items.
     */
    navSetup: function _setup(containerId, query) {
      var elements = null;
      debug('navSetup, containerId=' + containerId + ', query=' + query);

      var container = (containerId === undefined) ? document.body :
                   document.getElementById(containerId);

      if (container) {
        elements = container.querySelectorAll(query);
        if (elements.length > 0) {
          switch(containerId) {
            case MONTH_VIEW:
              monthViewNavUpdate(elements);
              break;
            case WEEK_VIEW:
              weekViewNavUpdate(elements);
              break;
            case DAY_VIEW:
            case OPTION_MENU:
            case MODIFY_EVENT:
            case SETTING:
            case SEARCH_VIEW:
            case CALENDAR_DISPLAY:
            case SHOW_MULTI_EVENTS:
            case CREATE_ACCOUNT:
            case MODIFY_ACCOUNT:
              listViewUpdate(elements);
              break;
            case SWITCHTO_DATE_VIEW:
              switchtoDateViewUpdate();
              break;
            default:
          }
        }
      }

      if (containerId && elements) {
        if (!controls[containerId]) {
          controls[containerId] = {};
          if (containerId === DAY_VIEW) {
            controls[containerId].index = 
                    this.getDayViewIndexByDate(new Date(), elements);
          } else {
            controls[containerId].index = (elements.length > 0) ? 0 : -1;
          }
        }
        controls[containerId].elements = elements;
      }
    },

    reset: function _reset(id) {
      debug('reset, id: ' + id);
      var index = -1;
      if (controls[id] && (controls[id].index > -1)) {
        index = controls[id].index;
      }

      switch(id) {
        case WEEK_VIEW:
          this.navSetup(id, '.focusable_week');
          break;
        case MODIFY_ACCOUNT:
          var modifyView = document.querySelector('#modify-account-view');
          if (window.location.pathname.indexOf('yahoo') != -1 ||
              (modifyView.className.indexOf('preset-yahoo') != -1 &&
              modifyView.className.indexOf('update') != -1)) {
            this.navSetup(id, '.yahoo_focusable');
          } else {
            this.navSetup(id, '.caldev_focusable');
          }
          break;
        case MONTH_VIEW:
          this.navSetup(id, '.month.active .focusable');
          break;
        default:
          this.navSetup(id, '.focusable');
      }
      index = (index > controls[id].elements.length - 1) ? 0 : index;

      //Focus current hour when enter Day view
      if (id == DAY_VIEW) {
        this.setFocusOnDayView();
      } else if (id === MONTH_VIEW) {
        var currentDate = new Date();
        if (index > -1) {
          var item = controls[id].elements[index];
          currentDate = dateFromId(item.dataset.date);
        }
        this.setFocusOnMonthView(currentDate);
      } else if (id == SEARCH_VIEW || id == SETTING ||
                id == MODIFY_EVENT || id == MODIFY_ACCOUNT) {
        this.setFocus(0);
        if (id == MODIFY_ACCOUNT) {
            var input = document.querySelector('.focus');
            if (input.setSelectionRange) {
              input.setSelectionRange(0, 0);
            }
        }
      } else if (id == SHOW_MULTI_EVENTS || id == CREATE_ACCOUNT) {
        index = getMultiReset() ? ((index < 0) ? 0 : index) : 0;
        this.setMultiResetValue(false);
        this.setFocus(index);
      } else {
        if (this._customWeekFocus.enable) {
          this.setCustomWeekFocus(this._customWeekFocus.type);
          return;
        }
        index = (index < 0)? 0 : index;
        this.setFocus(index);
      }
    },

    /* option menu */
    optionReset: function _reset() {
      debug('optionReset');
      this.navSetup(OPTION_MENU, '.menu-button');

      /* remove current focus, only one element has focus */
      var focused = document.querySelectorAll('.focus');
      for (var i = 0; i < focused.length; i++) {
        focused[i].classList.remove('focus');
      }

      var toFocused = controls[OPTION_MENU].elements[0];
      if (toFocused) {
        toFocused.setAttribute('tabindex', 1);
        toFocused.classList.add('focus');
        toFocused.focus();
        window.focus();
      }
    },

    scrollToElement: function _scroll(bestElementToFocus, evt) {
      debug('scrollToElement,');
      if (window.location.pathname === '/day/') {
        return;
      }

      function isVisible(bestElementToFocus) {
        if (bestElementToFocus.offsetWidth === 0 ||
            bestElementToFocus.offsetHeight === 0) {
          return false;
        }
        var height = document.documentElement.clientHeight - 40;
        var rects = bestElementToFocus.getClientRects();
        for (var i = 0, l = rects.length; i < l; i++) {
          var r = rects[i];
          if (r.bottom > 0 && r.bottom <= height && r.top >= 120) {
            return true;
          }
        }
        return false;
      }
      if (!isVisible(bestElementToFocus) &&
         !bestElementToFocus.classList.contains('focusBox__weekAllDayChild')) {
        switch (evt.key) {
          case 'ArrowDown':
            bestElementToFocus.scrollIntoView(false);
            break;
          case 'ArrowUp':
            bestElementToFocus.scrollIntoView(true);
            break;
        }
      }
    },

    getCurItem: function() {
      return getCurItem();
    },

    getCurIndex: function() {
      var curControl = getCurControl();
      if (curControl) {
        if (curControl.index >= 0 &&
          curControl.index < curControl.elements.length) {
          return curControl.index;
        }
      }
    },

    getDayViewIndexByDate: function(thisDate, elements) {
      var index = 0;
      var hour = thisDate.getHours();
      var targetItemSelector = '.md__hour-' + hour + ' .focusable';
      var targetItem = document.querySelector(targetItemSelector);
      if (elements && elements.length > 0) {
         for (var i = 0;i < elements.length; i++) {
           if (elements[i] === targetItem) {
             index = i;
           }
        }
      }
      return index;
    },

    setFocusOnDayView: function() {
      var index = 0;
      var curControl = getCurControl();
      var state = window.history.state;
      if ('eventStartHour' in state && state.eventStartHour !== undefined) {
        var hour = state.eventStartHour;
        if (hour == 'allday') {
          index = 0;
        } else {
          var targetItemStyle = '.md__hour-' + hour + ' .focusable';
          var targetItem = document.querySelector(targetItemStyle);
          if (curControl.elements && curControl.elements.length > 0) {
            var items = curControl.elements;
            for (var i = 0;i < items.length; i++) {
              if (items[i] === targetItem) {
                index = i;
              }
            }
          }
        }
      } else {
        index = curControl.index;
      }
      this.setFocus(index);
    },

    setFocusOnMonthView: function(date) {
      var curDate = date;
      var curControl = getCurControl();
      var index = 0;
      var target = 'd-' + curDate.getFullYear() + '-' + curDate.getMonth() + 
                    '-' + curDate.getDate();
      if (curControl.elements &&curControl.elements.length>0) {
        var items = curControl.elements;
        for (var i = 0;i < items.length; i++) {
           if (items[i].dataset.date === target) {
             index = i;
           }
         }
      }
      this.setFocus(index);
    },

    setCustomWeekFocus: function(type) {
      switch (type) {
        case 'current-date':
          var curIndex = this.getCurIndex();
          if (curIndex % 7 !== 0) {
            this.setFocus(curIndex - (curIndex % 7));
          }
          break;
        case 'onactive':
          var weekTitlesStyle = '#week-view .md__sticky ' + 
                                '.md__alldays > [aria-hidden=false]';
          var weekTitles = document.querySelectorAll(weekTitlesStyle);
          for (var i = 0; i < weekTitles.length; i++) {
            var weekTitleDate = new Date(weekTitles[i].dataset.date);
            if (weekTitleDate.getDate() === 
              this._customWeekFocus.targetDate.getDate()) {
              this.setFocus(i);
            }
          }
          break;
      }
      this._customWeekFocus.enable = false;
      this._customWeekFocus.type = '';
    },

    setMultiResetValue: function(value) {
      setMultiReset(value);
    }
  };

  module.exports = NavigationMap;
});
