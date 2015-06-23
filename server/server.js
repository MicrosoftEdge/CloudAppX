var express = require('express');
var cors = require('cors');
var fs = require('fs');

var app = express();

var corsOptions = {
  origin: 'http://localhost:3000'
};

app.use(cors(corsOptions));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


app.get('/v1/test', function(req, res) {
  console.log(process.cwd());
});

var server = app.listen(8080, function () {
  var port = server.address().port;
  console.log('Example app listening at http://localhost:%s', port);
});

