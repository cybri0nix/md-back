// modules
var express = require('express');
var logger = require('morgan');
var si = require('sql-injection');

var app = express();

const PORT = '5000';
const HOST = 'http://localhost:'+PORT;

global.consts = {
  // @example: postgres://[username]:[password]@[host]:[port]/[database]
  // @example: postgres://username:password@host:port/database
  PRODUCTION: false,
  DB_CONNECTION_STRING: 'postgres://localhost:5432/a1'
}

// Uses
app.use(si); 
app.use(logger('dev'));

app.all('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

// routes
var index = require('./routes/api');
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


app.listen(PORT, ()=>{
	console.log('server started at '+PORT);
})

module.exports = app;
