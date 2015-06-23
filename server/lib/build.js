var unzip = require('unzip');
var fs = require('fs');
var _ = require('lodash');
var Q = require('q');

function makeappx(file) {
  var deferred = Q.defer();
  if (file.xml) {
    getContents(file.xml).then(function(result) {
      deferred.resolve(result);
    });
  } else if (file.json) {
    getContents(file.json).then(function(result) {
      console.log('converting');
    });
  }
  return deferred.promise;
}

function getContents(file) {
  var deferred = Q.defer();
  var outputDir = _.trimRight(file.name, '.zip');
  fs.createReadStream(file.path)
    .pipe(unzip.Extract({ path: 'output/' + outputDir }))
    .on('close', function() {
      deferred.resolve(outputDir);
    });
  return deferred.promise;
}


module.exports = {makeappx: makeappx};
