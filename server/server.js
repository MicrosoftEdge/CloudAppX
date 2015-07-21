var express = require('express');
var cors = require('cors');
var fs = require('fs');
var multer = require('multer');
var util = require('util');
var Q = require('q');

var app = express();

var build = require('./lib/build');

var corsOptions = {
  origin: 'http://localhost:3000'
};

app.use(cors(corsOptions));

app.use(multer({dest: './uploads/'}));

app.use('/output', express.static('output'));

app.get('/v1/test', function(req, res) {
  console.log(process.cwd());
});

app.post('/v1/upload', function(req, res, next) {
  if (req.files) {
    console.log(util.inspect(req.files));
    build.getappx(req.files).then(function(file) {
      res.send(file.out);
    });
  }
});

function serve() {
  var deferred = Q.defer();
  var port = process.env.PORT || 8080;
  var server = app.listen(port, function () {
    var port = server.address().port;
    if (!process.env.TEST) {
      console.log('Example app listening at http://localhost:%s', port);
    }
    deferred.resolve(port);
  });
  return deferred.promise;
}

if (!module.parent) {
  serve();
} else {
  module.exports = serve;
}

