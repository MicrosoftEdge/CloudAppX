var fs = require('fs');
var Q = require('q');
var manifoldjs = require('manifoldjs');
var util = require('util');
var path = require('path');

var OUTPUT_PATH = 'windows10/manifest';

function getjson(manifest) {
  var deferred = Q.defer();
  var jsonManifest = path.join(manifest, 'manifest.json');
  manifoldjs.manifestTools.getManifestFromFile(jsonManifest, function(err, data) {
    deferred.resolve({json: data, path: manifest});
  });
  return deferred.promise;
}

function convertjson(manifest) {
  var deferred = Q.defer();
  console.log(util.inspect(manifest));
  manifoldjs.projectBuilder.createApps(manifest.json, manifest.path, ['WINDOWS10'], void 0, function(err) {
    if(err) {
      deferred.reject(err);
    }
    var appName = manifest.json.content.short_name;
    var output = {
      name: appName,
      dir: path.join(manifest.path, appName, OUTPUT_PATH),
      out: path.join(manifest.path, '../')
    };
    deferred.resolve(output);
  });
  return deferred.promise;
}

module.exports = {getjson: getjson, convertjson: convertjson};
