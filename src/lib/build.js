import fs from 'fs';
import {exec} from 'child_process';
import path from 'path';
import unzip2 from 'unzip2';
import os from 'os';
import del from 'del';
import denodeify from 'denodeify';
const execute = denodeify(exec, (err, stdout, stderr) => [err, {stdout, stderr}]);
const fsStat = denodeify(fs.stat);
const readdir = denodeify(fs.readdir);

const defaultToolsFolder = 'appxsdk';

const getAppx = async file => {
  try {
    const ctx = await getContents(file.xml);
    await makeAppx();
    await deleteContents(ctx);
    return;
  } catch (err) {
    console.log(err);
  }
};

// search for local installation of Windows 10 Kit in the Windows registry
const getWindowsKitPath = async toolname => {
  try {
    const cmdLine = 'powershell -Command "Get-ItemProperty \\"HKLM:\\SOFTWARE\\Microsoft\\Windows Kits\\Installed Roots\\" -Name KitsRoot10 | Select-Object -ExpandProperty KitsRoot10"';
    const result = await execute(cmdLine);
    const toolPath = path.resolve(result.stdout.replace(/[\n\r]/g, ''), 'bin', os.arch(), toolname);
    await fsStat(toolPath);
    return toolPath;
  } catch (err) {
    throw new Error('Cannot find the Windows 10 SDK tools.');
  }
};

// search for local installation of Windows 10 tools in app's subfolder
const getLocalToolsPath = async toolName => {
  // test WEBSITE_SITE_NAME environment variable to determine if the service is running in Azure, which
  // requires mapping the tool's location to its physical path using the %HOME_EXPANDED% environment variable
  try {
    const toolPath = process.env.WEBSITE_SITE_NAME
                    ? path.join(process.env.HOME_EXPANDED, 'site', 'wwwroot', defaultToolsFolder, toolName)
                    : path.join(path.dirname(require.main.filename), defaultToolsFolder, toolName);
    await fsStat(toolPath);
    return toolPath;
  } catch (err) {
    throw new Error(`Cannot find Windows 10 Kit Tools in the app folder (${defaultToolsFolder}).`);
  };
};

const makeAppx = async file => {
  if (os.platform() !== 'win32') {
    throw new Error('Cannot generate a Windows Store package in the current platform.');
  }
  const toolName = 'makeappx.exe';
  let toolPath;
  try {
    toolPath = await getLocalToolsPath(toolName);
  } catch (err) {
    toolPath = await getWindowsKitPath(toolName);
  }
  const packagePath = path.join(file.out, file.name + '.appx');
  const cmdLine = `"${toolPath}" pack /o /d ${file.dir} /p ${packagePath} /l`;
  let result;
  try {
    result = await execute(cmdLine);
    const {stdout, stderr} = result;
    return {
      dir: file.dir,
      out: packagePath,
      stdout,
      stderr
    };
  } catch (err) {
    const errmsg = result.stdout.match(/error:.*/g).map(item => item.replace(/error:\s*/, ''));
    throw new Error(errmsg ? errmsg.join('\n') : 'MakeAppX failed.');
  }
};

const getContents = file => {
  const outputDir = path.join('output', path.basename(file.name, '.' + file.extension));
  return new Promise((resolve, reject) => {
    fs.createReadStream(file.path)
      .on('error', err => {
        console.log(err);
        reject(new Error('Failed to open the uploaded content archive.'));
      })
      .pipe(unzip2.Extract({ path: outputDir }))
      .on('close', () => {
        fs.unlink(file.path, err => {
          if (err) console.log(err);
          var name = path.basename(file.originalname, '.' + file.extension);
          resolve({
            name,
            dir: path.join(outputDir, name),
            out: outputDir
          });
        });
      })
      .on('error', err => {
        console.log(err);
        reject(new Error('Failed to unpack the uploaded content archive.'));
      });
  });
};

const deleteContents = async ctx => {
  try {
    await del(ctx.dir);
  } catch (err) {
    console.log(`Error deleting content folder: ${err}`);
  }
  try {
    const files = await readdir(ctx.out);
    if (files.length === 0) await del(ctx.out);
  } catch (err) {
    console.log(`Error deleting output folder: ${err}`);
  }
};

export {getAppx, makeAppx};
