const path = require('path');
const express = require('express');

// Cấu hình EJS view engine và static files
function configViewEngine(app) {
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.static(path.join(__dirname, '..', 'public')));
}

module.exports = configViewEngine;
