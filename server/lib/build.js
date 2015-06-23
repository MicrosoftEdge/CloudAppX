var unzip = require('unzip');
var fs = require('fs');
var _ = require('lodash');
var Q = require('q');

function makeappx(file) {
  var deferred = Q.defer();
  if (file.xml) {
    fs.createReadStream(file.xml.path)
      .pipe(unzip.Extract({ path: 'output/' + _.trimRight(file.xml.name, '.zip')}))
      .on('close', function() {
        console.log('unzipped');
        deferred.resolve(test);
      });
  }
  return deferred.promise;
}


module.exports = {makeappx: makeappx};
