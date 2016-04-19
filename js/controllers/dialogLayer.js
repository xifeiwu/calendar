define(function(require, exports, module) {
'use strict';

var router = require('router');
var optionMenu = document.getElementById('calendar-option-menu');
var dialog = document.getElementById('calendar-dialog');

/**
 * Layer manager for setting aria-hidden
 */
function DialogLayerController() {}

module.exports = DialogLayerController;

DialogLayerController.setCurrentPage = function () {
  this.currentPage = router.activePage();
};

DialogLayerController.setAriaHidden = function () {
  this.setCurrentPage();
  if (!this.currentPage.hasAttribute('aria-hidden')) {
    this.currentPage.setAttribute('aria-hidden', true);
    this.currentActiveEle = this.currentPage;
  } else if (!dialog.hasAttribute('aria-hidden')) {
    dialog.setAttribute('aria-hidden', true);
    this.currentActiveEle = dialog;
  } else if (!optionMenu.hasAttribute('aria-hidden')) {
    optionMenu.setAttribute('aria-hidden', true);
    this.currentActiveEle = optionMenu;
  }
};

DialogLayerController.removeAriaHidden = function () {
  this.currentActiveEle.removeAttribute('aria-hidden');
};
});
