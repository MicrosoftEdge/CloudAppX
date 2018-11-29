'use strict';

var cloudappx = require('cloudappx');
var cloudappx_server = require('../server/server.js');
var path = require('path');
var fs = require('fs');
var expect = require('chai').expect;

describe('environment', function() {
  it ('has the proper environment variable set', function() {
    expect(process.env.CLOUDAPPX_SERVER).to.equal('http://localhost:8080');
    expect(process.env.ENABLE_V1_API).to.equal('true');
  });
});
describe('end to end', function() {
  this.timeout(10000);
  let server;
  before(function(done) {
    cloudappx_server().then(function(svr) {
      server = svr;
      cloudappx.cloudappx(path.join(__dirname, 'assets/testpkg')).then(done);
    });
  });
  after(function() {
    var pkgdir = path.join(__dirname, 'assets/testpkg.zip');
    var zipdir = path.join(__dirname, 'assets/testpkg.appx');
    if (fs.existsSync(pkgdir)) {
      fs.unlinkSync(pkgdir);
    }
    if (fs.existsSync(zipdir)) {
      fs.unlinkSync(zipdir);
    }
    server.close();
  });

  it ('generates the .zip file', function() {
    var zip = fs.existsSync(path.join(__dirname, 'assets/testpkg.zip'));
    expect(zip).to.exist;
  });

  it ('generates the .appx package', function() {
    var pkg = fs.existsSync(path.join(__dirname, 'assets/testpkg.appx'));
    expect(pkg).to.exist;
  });
});
