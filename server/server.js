var express = require('express');
var cors = require('cors');
var fs = require('fs');
var multer = require('multer');
var util = require('util');

var app = express();

var build = require('./lib/build');

var corsOptions = {
  origin: 'http://localhost:3000'
};

app.use(cors(corsOptions));

app.use(multer({dest: './uploads/'}));

app.get('/v1/test', function(req, res) {
  console.log(process.cwd());
});

app.post('/v1/upload', function(req, res, next) {
  if (req.files) {
    console.log(util.inspect(req.files));
    build.makeappx(req.files).then(function(test) {
      res.send(test);
    });
  }
});

var server = app.listen(8080, function () {
  var port = server.address().port;
  console.log('Example app listening at http://localhost:%s', port);
});

