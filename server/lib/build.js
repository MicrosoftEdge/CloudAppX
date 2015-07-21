var fs = require('fs');
var Q = require('q');
var exec = require('child_process').exec;
var util = require('util');
var path = require('path');
var unzip2 = require('unzip2');
var os = require('os');

var defaultToolsFolder = 'appxsdk';
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

// search for local installation of Windows 10 Kit in the Windows registry
function getWindowsKitPath(toolname) {
  var deferred = Q.defer();
  
  var cmdLine = 'powershell -Command "Get-ItemProperty \\"HKLM:\\SOFTWARE\\Microsoft\\Windows Kits\\Installed Roots\\" -Name KitsRoot10 | Select-Object -ExpandProperty KitsRoot10"';
  exec(cmdLine, function (err, stdout, stderr) {
    var notFound = new Error('Cannot find a local installation of the Windows 10 Kit Tools.');
    if (err) {
      return deferred.reject(notFound);
    }

    var toolPath = path.resolve(stdout.replace(/[\n\r]/g, ''), 'bin', os.arch(), toolname);
    fs.exists(toolPath, function (exists) {
      if (exists) {
        return deferred.resolve(toolPath);
      }

      return deferred.reject(notFound);
    });
  });
  
  return deferred.promise;
}

// search for installation of Windows 10 tools in app's subfolder
function getLocalToolsPath(toolname) {
  var deferred = Q.defer();
  
  // test WEBSITE_SITE_NAME environment variable to determine if running in Azure
  var toolPath = process.env.WEBSITE_SITE_NAME ? 
                  path.join(process.env.HOME_EXPANDED, 'site', 'wwwroot', defaultToolsFolder, toolname) :
                  path.join(path.dirname(require.main.filename), defaultToolsFolder, toolname);

  fs.exists(toolPath, function (exists) {
    if (!exists) {
      return deferred.reject(new Error('Unable to locate Windows 10 Kit Tools in app folder.'));
    }
    
    return deferred.resolve(toolPath);
  });

  return deferred.promise;
}

function getToolPath(toolName) {
  var deferred = Q.defer();
  getLocalToolsPath(toolName).then(
    function (toolPath) {
      deferred.resolve(toolPath);
    },
    function (err) {
      console.log(err.message);
      getWindowsKitPath(toolName).then(
        function (toolPath) {
          deferred.resolve(toolPath);
        },
        function (err) {
          console.log(err.message);
          deferred.reject(new Error('Unable to locate Windows 10 Kit Tools.'));
        }
      );
    }
  );

  return deferred.promise;
}

function makeappx(file) {
  var deferred = Q.defer();
  if (os.platform() === 'win32') {
    getToolPath('makeappx.exe').then(
      function (toolpath) {
        cmdLine = undefined;
        if (toolpath) {
          var packagePath = path.join(file.out, file.name + '.appx');
          cmdLine = '"' + toolpath + '" pack /o /d ' + file.dir + ' /p ' + packagePath + ' /l';
          console.log(cmdLine);
          exec(cmdLine, function (err, stdout, stderr) {
            if (err) {
              deferred.reject(err);
            }
            
            console.log(stdout);
            console.log(stderr);
            var output = {
              name: path.join(file.dir, file.name + '.appx'),
              out: packagePath,
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
