//var unzip = require('unzip');
var fs = require('fs');
var Q = require('q');
var exec = require('child_process').exec;
var util = require('util');
var path = require('path');
var unzip2 = require('unzip2');

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
  var cmdLine = '.\\appxsdk\\makeappx.exe pack /o /d ' + file.dir + ' /p ' + file.out + '\\Package.appx /l /v';
  //var cmdLine = 'touch ' + path.join(file.out, file.name + '.appx');
  console.log(cmdLine);
  exec(cmdLine, function(err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    var output = {
      name: path.join(file.dir, file.name + '.appx'),
      out: path.join(file.out, 'Package.appx'),
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
    .pipe(unzip2.Extract({ path: outputDir }))
    .on('close', function() {
      var name = file.originalname.slice(0,-4);
      deferred.resolve({name: name,
                       dir: path.join(outputDir, name),
                       out: outputDir });
    });
  return deferred.promise;
}


module.exports = {getappx: getappx};
