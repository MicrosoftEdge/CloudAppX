var unzip = require('unzip');
var fs = require('fs');
var _ = require('lodash');
var Q = require('q');
var exec = require('child_process').exec();

function getappx(file) {
  var deferred = Q.defer();
  if (file.xml) {
    getContents(file.xml)
    .then(makeappx)
    .then(function(result) {
        deferred.resolve(result);
      });
    } else if (file.json) {
    getContents(file.json).then(function(result) {
      console.log('converting');
    });
  }
  return deferred.promise;
}

function makeappx(directory) {
  var deferred = Q.defer();
  var cmdLine = 'powershell makeappx ' + directory;
  console.log(cmdLine);
  exec(cmdLine, function(err, stdout, stderr) {
    if (err) {
      deferred.reject(err);
    }
    deferred.resolve({stdout: stdout, stderr: stderr});
  });

  return deferred.promise;
}

function getContents(file) {
  var deferred = Q.defer();
  var outputDir = 'output/' + _.trimRight(file.name, '.zip');
  fs.createReadStream(file.path)
    .pipe(unzip.Extract({ path: outputDir }))
    .on('close', function() {
      deferred.resolve(outputDir);
    });
  return deferred.promise;
}


module.exports = {getappx: getappx};
