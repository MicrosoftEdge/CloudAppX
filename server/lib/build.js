var fs = require('fs'),
    Q = require('q'),
    exec = require('child_process').exec,
    util = require('util'),
    path = require('path'),
    unzip2 = require('unzip2'),
    os = require('os'),
    rmdir = Q.nbind(require('rimraf')),
    execute = Q.nbind(exec),
    fsStat = Q.nfbind(fs.stat);

var defaultToolsFolder = 'appxsdk';

function getAppx(file) {
  var ctx;
  
  return Q(file.xml)
    .then(getContents)
    .then(function (file) { return ctx = file; })
    .then(makeAppx)
    .finally(function () {
      if (ctx) {
        deleteContents(ctx.dir);
      }
    });
}

// search for local installation of Windows 10 Kit in the Windows registry
function getWindowsKitPath(toolname) {
  var cmdLine = 'powershell -Command "Get-ItemProperty \\"HKLM:\\SOFTWARE\\Microsoft\\Windows Kits\\Installed Roots\\" -Name KitsRoot10 | Select-Object -ExpandProperty KitsRoot10"';
  return execute(cmdLine)
    .then(function (args) {
      var toolPath = path.resolve(args[0].replace(/[\n\r]/g, ''), 'bin', os.arch(), toolname);
      return fsStat(toolPath)
                .thenResolve(toolPath);
    })
    .catch(function (err) {
      return Q.reject(new Error('Cannot find the Windows 10 SDK tools.'));
    });
}

// search for local installation of Windows 10 tools in app's subfolder
function getLocalToolsPath(toolName) {
  // test WEBSITE_SITE_NAME environment variable to determine if the service is running in Azure, which  
  // requires mapping the tool's location to its physical path using the %HOME_EXPANDED% environment variable
  var toolPath = process.env.WEBSITE_SITE_NAME ?
                  path.join(process.env.HOME_EXPANDED, 'site', 'wwwroot', defaultToolsFolder, toolName) :
                  path.join(path.dirname(require.main.filename), defaultToolsFolder, toolName);
  
  return fsStat(toolPath)
    .thenResolve(toolPath)
    .catch(function (err) {
      return Q.reject(new Error('Cannot find Windows 10 Kit Tools in the app folder (' + defaultToolsFolder + ').'));
    });
}

function makeAppx(file) {
  if (os.platform() !== 'win32') {
    return Q.reject(new Error('Cannot generate a Windows Store package in the current platform.'));
  }
  
  var toolName = 'makeappx.exe';
  return getLocalToolsPath(toolName)
          .catch(function (err) {
            return getWindowsKitPath(toolName);
          })
          .then(function (toolPath) {
            var packagePath = path.join(file.out, file.name + '.appx');
            cmdLine = '"' + toolPath + '" pack /o /d ' + file.dir + ' /p ' + packagePath + ' /l';
            var deferred = Q.defer();
            exec(cmdLine, function (err, stdout, stderr) {             
              if (err) {
                var errmsg = stdout.match(/error:.*/g).map(function (item) { return item.replace(/error:\s*/, ''); });
                return deferred.reject(errmsg ? errmsg.join('\n') : 'MakeAppX failed.');
              }
      
              deferred.resolve({
                dir: file.dir,
                out: packagePath,
                stdout: stdout,
                stderr: stderr
              });
            });

            return deferred.promise;
          });
}

function getContents(file) {
  var deferred = Q.defer();
  var outputDir = path.join('output', path.basename(file.name, '.' + file.extension));
  fs.createReadStream(file.path)
    .on('error', function (err) {
      console.log(err);
      deferred.reject(new Error('Failed to open the uploaded content archive.'));
    })
    .pipe(unzip2.Extract({ path: outputDir }))
    .on('close', function () {
      fs.unlink(file.path, function (err) {
        if (err) {
          console.log(err);
        }
      
        var name = path.basename(file.originalname, '.' + file.extension);
        deferred.resolve({
          name: name,
          dir: path.join(outputDir, name),
          out: outputDir
        });
      });
    })
    .on('error', function (err) {
      console.log(err);
      deferred.reject(new Error('Failed to unpack the uploaded content archive.'));
    });
  
  return deferred.promise;
}

function deleteContents(dir) {
  return rmdir(dir)
          .catch(function (err) { 
            console.log('Error deleting content folder: ' + err);
          });
}

module.exports = { getAppx: getAppx, makeAppx: makeAppx };
