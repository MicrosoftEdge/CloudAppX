var unzip = require('unzip');
var fs = require('fs');
var _ = require('lodash');
var Q = require('q');

function makeappx(file) {
  var deferred = Q.defer();
  if (file.xml) {
    var outputDir = _.trimRight(file.xml.name, '.zip');
    fs.createReadStream(file.xml.path)
      .pipe(unzip.Extract({ path: 'output/' + outputDir}))
      .on('close', function() {
        console.log('unzipped');
        deferred.resolve(outputDir);
      });
  }
  return deferred.promise;
}


module.exports = {makeappx: makeappx};
