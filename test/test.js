'use strict';

var cloudappx = require('cloudappx');
var cloudappx_server = require('../server/server.js');
var path = require('path');
var fs = require('fs');
var expect = require('chai').expect;

describe('end to end', function() {
  before(function(done) {
    cloudappx_server().then(function() {
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
