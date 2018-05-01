
module.exports = function(grunt) {
  'use strict';

  // Just set shell commands for running different types of tests
  grunt.initConfig({
    _test_runner: 'mocha',
    _unit_args: '-A -u exports --recursive -t 10000 ./test/unit',

    // These are the properties that grunt-fh-build will use
    unit: '<%= _test_runner %> <%= _unit_args %> mocha --exit',
    unit_cover: 'istanbul cover --dir cov-unit <%= _test_runner %> -- <%= _unit_args %>',

    integrate:['<%= _test_runner %> ./test/integrate'],
    accept:['<%= _test_runner %> ./test/accept']
  });

  grunt.loadNpmTasks('grunt-fh-build');
  grunt.registerTask('default', ['fh-default']);
};
