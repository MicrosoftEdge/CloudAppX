import util from 'util';
import {getAppx} from './lib/build';
import fs from 'fs';
import del from 'del';
import path from 'path';

const build = async (req, res) => {
  console.log('Building package...');
  console.log(req.files);
  if (req.fies) {
    let filepath;
    try {
      console.log(util.inspect(req.files));
      filepath = await getAppx(req.files);
      res.set('Content-type', 'application/octet-stream');
      const reader = fs.createReadStream(filepath.out);
      reader.on('end', () => {
        console.log('Package download completed.');
        res.status(201).end();
      });
      reader.on('error', err => {
        console.log(`Error streaming package contents: ${err}`);
        res.status(500).send('APPX package download failed.').end();
      });
      reader.pipe(res);
    } catch (err) {
      console.log(`Package generation failure: ${err}`);
      res.status(500).send(`APPX package generation failed. ${err}`);
    }
    try {
      if (filepath.out) await del(path.dirname(filepath.out));
    } catch (err) {
      console.log(`Error deleting generated package: ${err}`);
    }
  }
  return;
};

export {build};
