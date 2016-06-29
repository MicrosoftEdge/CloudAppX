var express = require('express'),
    fs = require('fs'),
    multer = require('multer'),
    util = require('util'),
    Q = require('q'),
    rmdir = Q.nfbind(require('rimraf')),
    url = require('url'),
    path = require('path');

var app = express();

var build = require('./lib/build');

// API v1 has greater potential for leaving orphaned temporary files
// and is disabled by default. To enable it, define an environment 
// variable (or an appsetting in an Azure website) 
//    ENABLE_V1_API = (true | yes | 1)
function isV1ApiEnabled() {
  var enableV1Api = process.env.ENABLE_V1_API;
  if (enableV1Api) {
    switch (enableV1Api.trim().toLowerCase()) {
      case 'true': case 'yes': case '1': return true;
      case 'false': case 'no': case '0': case null: return false;
      default: return false;
    }
  }

  return false;
}

if (isV1ApiEnabled()) {
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
  });

  app.use('/output', express.static('output'));

  app.get('/v1/test', function (req, res) {
    console.log(process.cwd());
    res.set('Content-Type', 'text/plain');
    res.send('Welcome to CloudAppX');
  });

  app.post('/v1/upload', multer({ dest: './uploads/' }), function (req, res, next) {
    if (req.files) {
      console.log(util.inspect(req.files));
      build.getAppx(req.files).then(function (file) {
        res.send(file.out);
      })
      .catch(function (err) {
        res.status(500).send('APPX package generation failed.');
      });
    }
  });
}

app.get('/v2/test', function (req, res) {
  console.log(process.cwd());
  res.set('Content-Type', 'text/plain');
  res.send('Welcome to CloudAppX');
});

app.post('/v2/build', multer({ dest: './uploads/' }), function (req, res) { buildPackage(req, res, false); });
app.post('/v3/build', multer({ dest: './uploads/' }), function (req, res) { buildPackage(req, res, true); });

function buildPackage (req, res, runMakePri) {
  console.log('Building package...');
  if (req.files) {
    console.log(util.inspect(req.files));
    var filepath;
    build.getAppx(req.files, runMakePri).then(function (file) {
      filepath = file.out;
      res.set('Content-type', 'application/octet-stream');
      var reader = fs.createReadStream(filepath);
      reader.on('end', function () {
        console.log('Package download completed.');
        res.status(201).end();
      });
      reader.on('error', function (err) {
        console.log('Error streaming package contents: ' + err);
        res.status(500).send('APPX package download failed.').end();
      });
      reader.pipe(res);
    })
    .catch(function (err) {
      console.log('Package generation failure: ' + err);
      res.status(500).send('APPX package generation failed. ' + err).end();
    })
    .finally(function () {
      if (filepath) {
        var packageDir = path.dirname(filepath);
        rmdir(packageDir).catch(function (err) {
          console.log('Error deleting generated package: ' + err);
        });
      }
    })
    .done();
  }
}

app.post('/v3/makepri', multer({ dest: './uploads/' }), function (req, res) {
  console.log('Indexing app resources...');
  if (req.files) {
    console.log(util.inspect(req.files));
    var filepath;
    build.getPri(req.files).then(function (file) {
      filepath = file.outputFile;
      res.set('Content-type', 'application/octet-stream');
      var reader = fs.createReadStream(filepath);
      reader.on('end', function () {
        console.log('PRI file download completed.');
        res.status(201).end();
      });
      reader.on('error', function (err) {
        console.log('Error streaming PRI file contents: ' + err);
        res.status(500).send('PRI file download failed.').end();
      });
      reader.pipe(res);
    })
    .catch(function (err) {
      console.log('PRI file generation failure: ' + err);
      res.status(500).send('PRI file generation failed. ' + err).end();
    })
    .finally(function () {
      if (filepath) {
        var packageDir = path.dirname(filepath);
        rmdir(packageDir).catch(function (err) {
          console.log('Error deleting generated PRI file: ' + err);
        });
      }
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
