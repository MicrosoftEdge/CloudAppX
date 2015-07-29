var express = require('express');
var cors = require('cors');
var fs = require('fs');
var multer = require('multer');
var util = require('util');
var Q = require('q');
var rmdir = require('rimraf');
var url = require('url');
var path = require('path');

var app = express();

var build = require('./lib/build');

var corsOptions = {
  origin: 'http://localhost:3000'
};

app.use(cors(corsOptions));

app.use('/output', function (req, res, next) {
  req.on('end', function () {
    var pathname = url.parse(req.url).pathname;
    if (pathname) {
      var packageDir = path.dirname(path.join(__dirname, 'output', pathname));
      console.log('Deleting: ', packageDir);
      rmdir(packageDir, function (err) {
        if (err) {
          console.log(err);
        }
      });
    }
  });

  next();
})

app.use('/output', express.static('output'));

app.get('/v1/test', function (req, res) {
  console.log(process.cwd());
  res.set('Content-Type', 'text/plain');
  res.send('Welcome to CloudAppX');
});

app.post('/v1/upload', multer({ dest: './uploads/' }), function (req, res, next) {
  if (req.files) {
    console.log(util.inspect(req.files));
    build.getappx(req.files).then(
      function (file) {
        res.send(file.out);
      },
      function (err) {
        res.status(500).send('APPX package generation failed.');
      }
    );
  }
});

app.post('/v2/build', multer({ dest: './uploads/' }), function (req, res) {
  console.log('Building package...');
  if (req.files) {
    console.log(util.inspect(req.files));
    var filepath;
    build.getappx(req.files)
      .then(function (file) {
        res.set('Content-type', 'application/octet-stream');
        filepath = path.join(__dirname, file.out);
        var reader = fs.createReadStream(filepath);
        reader.pipe(res);
        reader.on('end', function () {
          console.log('Package download completed!');
          res.status(201).end();
        });
      },
      function (err) {
        console.log('Error generating package: ' + err);
      })
      .fail(function (err) {
        console.log('Package generation failure: ' + err);
        res.status(500).send('APPX package generation failed.').end();
      })
      .finally(function () {
        var packageDir = path.dirname(filepath);
        rmdir(packageDir, function (err) {
          if (err) {
            return console.log('Error deleting generated package: ' + err);
          }
        });
      })
      .done();
  }
});

app.use(function (err, req, res, next) {
  console.error('Unhandled exception processing the APPX package: ' + err);
  res.status(500).send('There was an error generating the APPX package.');
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

process.on('uncaughtException', function (err) {
  console.log('An unhandled exception occurred: ' + err);
  process.exit(1);
});

if (process.env.WEBSITE_SITE_NAME || !module.parent) {
  serve();
} else {
  module.exports = serve;
}
