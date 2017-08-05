// modules
var express = require('express');
var logger = require('morgan');
var si = require('sql-injection');
// routes
var index = require('./routes/api');

var app = express();

// Uses
app.use(si); 
app.use(logger('dev'));
app.use(index);

// Catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
