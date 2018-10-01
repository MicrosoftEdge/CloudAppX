var fs = require('fs'),
    Q = require('q'),
    exec = require('child_process').exec,
    spawn = require('child_process').spawn,
    path = require('path'),
    unzip2 = require('unzip2'),
    os = require('os'),
    rmdir = Q.nfbind(require('rimraf')),
    execute = Q.nfbind(exec),
    fsStat = Q.nfbind(fs.stat),
    readdir = Q.nfbind(fs.readdir);

var defaultToolsFolder = 'appxsdk';

function spawnShell(cmdLineToRun) {
  const deferred = Q.defer();

  var result = {
    stderr: "",
    stdout: ""
  }

  const command = spawn(cmdLineToRun, {shell: true});
  
  command.stderr.on('data', (stderr) => {
    result.stderr += stderr;
  });
  
  command.stdout.on('data', (stdout) => {
    result.stdout += stdout;
  });

  command.on('error', (err) => {
    return deferred.reject(err);
  });

  command.on("close", () => {
    deferred.resolve(result);
  });

  return deferred.promise;
}

function getAppx(file, runMakePri) {
  // unzip package content
  return Q.fcall(getContents, file.xml).then(function (fileInfo) {    
    // optionally compile the app resources
    return (runMakePri ? Q.fcall(compileResources, fileInfo) : Q())
    // generate APPX file
    .then(function () {
      return makeAppx(fileInfo); 
    })
    .finally(function () {
      // clean up package contents
      return deleteContents(fileInfo);
    });
  })
}

function getPri(file) {
  // unzip package content
  return Q.fcall(getContents, file.xml).then(function (fileInfo) {
    // generate PRI file
    return Q.fcall(makePri, fileInfo.dir, fileInfo.out)
    // clean up package contents
    .finally(function () {
      return deleteContents(fileInfo);
    });
  })
}

// search for local installation of Windows 10 Kit in the Windows registry
function getWindowsKitPath(toolname) {
  var cmdLine = 'powershell -noprofile -noninteractive -Command "Get-ItemProperty \\"HKLM:\\SOFTWARE\\Microsoft\\Windows Kits\\Installed Roots\\" -Name KitsRoot10 | Select-Object -ExpandProperty KitsRoot10"';
  return execute(cmdLine).then(function (args) {
    var toolPath = path.resolve(args[0].replace(/[\n\r]/g, ''), 'bin', os.arch(), toolname);
    return fsStat(toolPath).thenResolve(toolPath);
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

// reads an app manifest and returns the package identity
// see https://msdn.microsoft.com/en-us/library/windows/apps/br211441.aspx
function getPackageIdentity(manifestPath) {
  // defines a globally unique identifier for a package
  var identityElement = /<Identity\s+[^>]+\>/;

  // A string between 3 and 50 characters in length that consists of alpha-numeric, period, and dash characters
  var nameAttribute = /Name="([A-Za-z0-9\-\.]+?)"/;

  return Q.nfcall(fs.readFile, manifestPath).then(function (data) {
    var identityMatch = data.toString().match(identityElement);
    if (identityMatch) {
      var nameMatch = identityMatch[0].match(nameAttribute);
      if (nameMatch) {
        return nameMatch[1];
      }
    }
  });
}

// compiles resources to generate a PRI file for the app package  
function compileResources(fileInfo) {
  // run MakePri
  return Q.fcall(makePri, fileInfo.dir, fileInfo.out, true).then(function (priInfo) { 
    // move generated PRI file into package folder
    var targetPath = path.join(fileInfo.dir, path.basename(priInfo.outputFile));
    return Q.nfcall(fs.rename, priInfo.outputFile, targetPath);
  })
}

// generates a resource index file (PRI)
function makePri(projectRoot, outputFolder) {
  if (os.platform() !== 'win32') {
    return Q.reject(new Error('Cannot compile Windows resources in the current platform.'));
  }
  
  var toolName = 'makepri.exe';
  var priFileName = 'resources.pri';
  var outputFile = path.join(outputFolder, priFileName);
  return Q.nfcall(fs.unlink, outputFile).catch(function (err) {
    // delete existing file and report any error other than not found
    if (err.code !== 'ENOENT') {
      throw err;
    }    
  })
  .then (function () {
    return getLocalToolsPath(toolName).catch(function (err) {
      return getWindowsKitPath(toolName);
    })
    .then(function (toolPath) {
      var manifestPath = path.join(projectRoot, 'appxmanifest.xml');
      return getPackageIdentity(manifestPath).then(function (packageIdentity) {
        var deferred = Q.defer();

        // check if a MakePri configuration file was provided, otherwise use the default file in 'assets'
        var configFile = 'priconfig.xml';
        var configPath = path.join(projectRoot, configFile);
        fsStat(configPath).catch(function (err) {
            configPath = path.resolve(__dirname, '..', 'assets', configFile);
        }).finally(function() {
            console.log("Using " + configFile + " path: " + configPath);
            var cmdLine = '"' + toolPath + '" new /o /pr "' + projectRoot + '" /cf "' + configPath + '" /of "' + outputFile + '" /in ' + packageIdentity;

            spawnShell(cmdLine).then((result) => deferred.resolve({
              projectRoot: projectRoot,
              outputFile: outputFile,
              stderr: result.stderr,
              stdout: result.stdout
              })
            ).catch((error) => deferred.reject(error));
        });

        return deferred.promise;
      });
    });
  })
}

function makeAppx(fileInfo) {
  if (os.platform() !== 'win32') {
    return Q.reject(new Error('Cannot generate a Windows Store package in the current platform.'));
  }
  
  var toolName = 'makeappx.exe';
  return getLocalToolsPath(toolName).catch(function (err) {
    return getWindowsKitPath(toolName);
  })
  .then(function (toolPath) {
    var appxPackagePath = path.join(fileInfo.out, fileInfo.name + '.appx');
    var cmdLine = '"' + toolPath + '" pack /o /d ' + fileInfo.dir + ' /p ' + appxPackagePath + ' /l';
    var deferred = Q.defer();

    spawnShell(cmdLine).then((result) => {
      const regex = /error:.*/g;
      var toolHadErrors = result.stdout && regex.test(result.stdout);
      if (toolHadErrors) {
        regex.lastIndex = 0;
        const errorMessages = regex.exec(result.stdout).map(function (item) { return item.replace(/error:\s*/, ''); });
        deferred.reject(errorMessages);
      } else {
        deferred.resolve({
          dir: fileInfo.dir,
          out: appxPackagePath,
          stderr: result.stderr,
          stdout: result.stdout
          });
      }
    }).catch((error) => deferred.reject(error));

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

function deleteContents(fileInfo) {
  return rmdir(fileInfo.dir).catch(function (err) {
    console.log('Error deleting content folder: ' + err);
  })
  .then(function () {
    return readdir(fileInfo.out);
  })
  .then(function (files) {
    if (files.length === 0) {
      return rmdir(fileInfo.out)
    }
  })
  .catch(function (err) {
    console.log('Error deleting output folder: ' + err);
  });
}

module.exports = { getAppx: getAppx, getPri: getPri, makeAppx: makeAppx, makePri: makePri };
