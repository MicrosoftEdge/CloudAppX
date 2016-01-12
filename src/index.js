import 'babel-polyfill';
import express from 'express';
import multer from 'multer';
import {build} from './controllers';

const app = express();

app.get('/v2/test', (req, res) => {
  console.log(process.cwd());
  res.set('Content-Type', 'text/plain');
  res.send('Welcome to CloudAppX');
});

app.use((err, req, res, next) => {
  console.error(`Unhandled exception processing the APPX package: ${err}`);
  res.status(500).send('There as an error generating the APPX package');
});

app.post('/v2/build', multer({dest: './uploads/'}), build);

const serve = () => {
  const port = process.env.PORT || 8080;
  const server = app.listen(port, () => {
    var port = server.address().port;
    if (!process.env.TEST) {
      console.log('Example app listening at http://localhost:%s', port);
    }
  });
};

if (process.env.WEBSITE_SITE_NAME || !module.parent) {
  serve();
}

process.on('uncaughtException', err => {
  console.log(`An unhandled exception occured: ${err}`);
  process.exit(1);
});

export {app};
