(function() {
'use strict';

window.require = window.require || window.curl;

require.config({
  baseUrl: '/js',
  waitSeconds: 60,
  paths: {
    shared: '../shared',
    dom: 'curl/plugin/dom',
    css: 'curl/plugin/css',
    evt: '../shared/evt/index',
    SpatialNavigator: '../shared/navigation_manager/spatial_navigator',
    KeyNavigationAdapter: '../shared/navigation_manager/key_navigation_adapter',
    SimpleKeyNavigator: '../shared/simple_key_navigator/dist/amd/simple_key_navigator'
  },
  shim: {
    'ext/caldav': { exports: 'Caldav' },
    'ext/ical': { exports: 'ICAL' },
    'ext/page': { exports: 'page' },
    'shared/accessibility_helper/accessibility_helper':
      { exports: 'AccessibilityHelper' },
    'shared/gesture_detector/gesture_detector': { exports: 'GestureDetector' },
    'shared/input_parser/input_parser': { exports: 'InputParser' },
    'shared/lazy_loader/lazy_loader': { exports: 'LazyLoader' },
    'shared/notification_helper/notification_helper':
      { exports: 'NotificationHelper' },
    'shared/performance_testing_helper/performance_testing_helper':
      { exports: 'PerformanceTestingHelper' },
    'shared/navigation_manager/navigation_manager':
      { exports: 'NavigationManager' },
    'shared/soft_keys_helper/soft_keys_helper':
      { exports: 'SoftKeysHelper' }
  }
});

// first require.config call is used by r.js optimizer, so we do this second
// call to list modules that are bundled to avoid duplicate defines
require.config({
  paths: {
    'views/week': 'lazy_loaded',
    'views/advanced_settings': 'lazy_loaded',
    'views/create_account': 'lazy_loaded',
    'views/day': 'lazy_loaded',
    'views/modify_account': 'lazy_loaded',
    'views/modify_event': 'lazy_loaded',
    'views/event_list': 'lazy_loaded',
    'views/settings': 'lazy_loaded',
    'views/view_event': 'lazy_loaded'
  }
});

require(['app'], app => app.init());

}());
