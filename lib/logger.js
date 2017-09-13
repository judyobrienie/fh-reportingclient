var bunyan = require('bunyan');
var logger;

module.exports = function getLogger() {
  if (!logger) {
    logger = bunyan.createLogger({name: "fh-reporting"});
  }
  return logger;
};