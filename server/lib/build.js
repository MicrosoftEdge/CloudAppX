var unzip = require('unzip');
var fs = require('fs');
var Q = require('q');
var exec = require('child_process').exec;
var util = require('util');
var path = require('path');

var convert = require('./convert');

function getappx(file) {
  var deferred = Q.defer();
  if (file.xml) {
    getContents(file.xml)
    .then(makeappx)
    .then(function(result) {
        deferred.resolve(result);
      });
    } else if (file.json) {
    getContents(file.json)
      .then(function(result) {
        var deferred = Q.defer();
        fs.readdir(result.dir, function(err, list) {
          if (err) {
            deferred.reject(err);
          }
          deferred.resolve(path.join(result.dir,list[0]));
        });
        return deferred.promise;
      })
      .then(convert.getjson)
      .then(convert.convertjson)
      .then(makeappx)
      .then(function(result) {
        console.log(result);
        deferred.resolve(result);
      });
  }
  return deferred.promise;
}

function makeappx(file) {
  var deferred = Q.defer();
  //var cmdLine = 'powershell makeappx ' + file.dir;
  var cmdLine = 'touch ' + path.join(file.out, file.name + '.appx');
  console.log(cmdLine);
  exec(cmdLine, function(err, stdout, stderr) {
    var output = {
      name: path.join(file.dir, file.name + '.appx'),
      out: path.join(file.out, file.name + '.appx'),
      stdout: stdout,
      stderr: stderr
    };
    deferred.resolve(output);
  });

  return deferred.promise;
}

function getContents(file) {
  var deferred = Q.defer();
  var outputDir = path.join('output', file.name.slice(0,-4));
  fs.createReadStream(file.path)
    .pipe(unzip.Extract({ path: outputDir }))
    .on('close', function() {
      deferred.resolve({name: file.originalname.slice(0,-4),
                       dir: outputDir,
                       out: outputDir });
    });
  return deferred.promise;
}


module.exports = {getappx: getappx};
