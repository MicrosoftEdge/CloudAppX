//var unzip = require('unzip');
var fs = require('fs');
var Q = require('q');
var exec = require('child_process').exec;
var util = require('util');
var path = require('path');
var unzip2 = require('unzip2');
var os = require('os');

var defaultToolsFolder = '.\\appxsdk\\';
var packageName = 'package.appx';

function getappx(file) {
  var deferred = Q.defer();
  getContents(file.xml)
  .then(makeappx)
  .then(function(result) {
    deferred.resolve(result);
  });
  return deferred.promise;
}

function getLocalToolPath(toolname) {
  var deferred = Q.defer();
  var cmdLine = 'powershell -Command "Get-ItemProperty \\"HKLM:\\SOFTWARE\\Microsoft\\Windows Kits\\Installed Roots\\" -Name KitsRoot10 | Select-Object -ExpandProperty KitsRoot10"';
  exec(cmdLine, function (err, stdout, stderr) {
    if (err) {
      console.log(err);
      return deferred.reject(new Error('Failed to retrieve the Windows 10 Kit path.'));
    } else if (stderr.length) {
      console.log(stderr.trim());
    }
    
    var toolPath = path.resolve(stdout.replace(/[\n\r]/g, ''), 'bin', os.arch(), toolname);
    fs.exists(toolPath, function (exists) {
      if (exists) {
        return deferred.resolve(toolPath);
      }
      
      toolPath = path.resolve(__dirname, defaultToolsFolder + toolname);
      fs.exists(toolPath, function (exists) {
        if (!exists) {
          toolPath = undefined;
        }
        
        return deferred.resolve(toolPath);
      });
    });
  });
  
  return deferred.promise;
};

function makeappx(file) {
  var deferred = Q.defer();
  if (os.platform() === 'win32') {
    getLocalToolPath('makeappx.exe').then(
      function (toolpath) {
        cmdLine = undefined;
        if (toolpath) {
          cmdLine = '"' + toolpath + '" pack /o /d ' + file.dir + ' /p ' + file.out + '\\' + packageName + ' /l /v';
          console.log(cmdLine);
          exec(cmdLine, function (err, stdout, stderr) {
            if (err) {
              deferred.reject(err);
            }
            
            console.log(stdout);
            console.log(stderr);
            var output = {
              name: path.join(file.dir, file.name + '.appx'),
              out: path.join(file.out, packageName),
              stdout: stdout,
              stderr: stderr
            };
            
            deferred.resolve(output);
          });
        }
      },
      function (err) {
        deferred.reject(err);
      });
  } else {
    deferred.reject(new Error('Cannot generate a Windows Store package in the current platform.'));
  }
  
  return deferred.promise;
};

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


module.exports = {getappx: getappx, makeappx: makeappx};
