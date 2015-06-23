var gulp = require('gulp');
var nodemon = require('gulp-nodemon');
var config = require('../config').nodemon;

gulp.task('nodemon', function() {
  nodemon(config).
    on('restart', function() {
    console.log('server restarted!');
  });

});
