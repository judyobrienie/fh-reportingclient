var fs = require('fs');
var async = require('async');
var crypto = require('crypto');
var MBaaSReporting = require('./mbaas-reporting');
var backUpFileStream;
var recoveryFileStream;
var request = require('request');

var mbaasReporting = new MBaaSReporting();

exports.Reporting = Reporting;

function Reporting(config, lgr) {
  validateConfig(config);
  this.config = config;
  if (lgr) {
    this.lgr = lgr;
  } else {
    this.lgr = {
      info: function() {},
      debug: function() {},
      error: function() {}
    };
  }
  this.msgNumPrefix = crypto.createHash('md5').update(Math.random().toString()).digest('hex');
  this.msgNumCounter = 0;
}

Reporting.prototype.msgNum = function() {
  return "" + this.msgNumPrefix + "_" + (this.msgNumCounter++);
};

Reporting.prototype.flushReports = function() {
  mbaasReporting.flushBatch();
};

Reporting.prototype.logMessageToMBaaS = function(topic, msg, cb) {
  //do not log to mbaas in openshift2
  if (this.config && this.config.mbaasType === "openshift") {
    return cb();
  }

  var isRealtimeLoggingEnabled = (this.config && this.config.realTimeLoggingEnabled === true);
  if (isRealtimeLoggingEnabled) {
    mbaasReporting.acceptMessage(topic, msg, function(err) {
      if (err) {
        cb(null, { handler:'logMessageToMBaaS', result: { status:'fail', reason:'mbaas call failed. Message still in batch for retry', info: {} }});
      } else {
        cb(null, { handler:'logMessageToMBaaS', result: { status:'ok', reason:'logged to mbaas', info:{} }});
      }
    });
  } else {
    cb(null, { handler:'logMessageToMBaaS', result: { status:'ok', reason:'Realtime Logging DISABLED: Ignoring message', info:{} }});
  }
};

Reporting.prototype.logMessageToOs2 = function(topic, msg, cb) {
  var self = this;
  //only interested in os2. os3 and feedhenry go through mbaas
  if (this.config && this.config.mbaasType !== "openshift") {
    return cb();
  }
  // bugfix 3102: only do realtime sending if config to do so is set
  if (this.config && this.config.realTimeLoggingEnabled !== true) {
    return cb();
  }


  if (this.config && this.config.msgServer && this.config.msgServer.logMessageURL) {
    var apiToCall = this.config.msgServer.logMessageURL.replace(/TOPIC/g, topic);
    this.lgr.debug("logMessageToHTTP(): Calling API URL " + apiToCall);
    request({
      uri: apiToCall,
      method: 'POST',
      json: msg
    }, function(error, response, body) {
      if (!error && response && response.statusCode === 200) {
        self.lgr.debug("Successfully logged message: " + body); // Print the response
      } else {
        self.lgr.error("Error logging message, error: " + JSON.stringify(error) + ", statusCode: " + ((response)?response.statusCode:"no response") + ", body: " + body);
        if (self.config && self.config.recoveryFiles && self.config.recoveryFiles.fileName) {
          var fileName = self.config.recoveryFiles.fileName.replace(/TOPIC/g, topic);
          self.saveToFile(fileName, formatMessageForFile(msg, topic), function() {});
        } else {
          self.lgr.info('Not saving to recovery file, since no recoveryFiles config');
        }
      }
      return cb(error, {handler: "logMessageToHTTP", result: {status: "ok", reason: "success", info: {response: response, body: body}}});
    });
  } else {
    self.lgr.info('Not sending to message server, since no msgServer config');
    return cb(null, {handler:  "logMessageToHTTP", result: {status: "fail", reason: "no config", info: {}}});
  }
};

Reporting.prototype.logMessageToFile = function(topic, msg, cb) {
  if (this.config && this.config.backupFiles && this.config.backupFiles.fileName) {
    var fileName = this.config.backupFiles.fileName.replace(/TOPIC/g, topic);
    this.lgr.debug("logMessageToFile(): fileName: " + fileName);
    this.saveToFile(fileName, formatMessageForFile(msg, topic), function(err) {
      if (!err) {
        cb(null, {handler:  "logMessageToFile", result: {status: "ok", reason: "success", info: {}}});
      }
    });
  } else {
    this.lgr.info('Not saving to backup file, since no backupFiles config');
    cb(null, {handler:  "logMessageToFile", result: {status: "fail", reason: "no config", info: {}}});
  }
};

function formatMessageForFile(msg, topic) {
  return {"MD5": reportingutils.MD5(JSON.stringify(msg)), "message": msg, "topic": topic};
}

//note backUpFileStream and recoveryFileStream are singletons and are only created once per application lifecycle.
//this is to address the problem of having too many file handles open ticket
Reporting.prototype.saveToFile = function(filepath, msg, cb) {
  var stream;
  var fileFlags = {flags:'a'};
  if (this.config.backupFiles && filepath === this.config.backupFiles.fileName) {
    if (!backUpFileStream) {
      backUpFileStream = fs.createWriteStream(filepath,fileFlags);
    }
    stream = backUpFileStream;
  } else if (this.config.recoveryFiles && filepath === this.config.recoveryFiles.fileName) {
    if (!recoveryFileStream) {
      recoveryFileStream = fs.createWriteStream(filepath,fileFlags);
    }
    stream = recoveryFileStream;
  } else if (filepath) {
    //fallback to creating a write stream and destroying it?
    var tempStream = fs.createWriteStream(filepath , fileFlags);
    tempStream.write(JSON.stringify(msg) + "\n");
    tempStream.destroySoon();
  }
  if (stream) {
    stream.write(JSON.stringify(msg) + "\n");
  }
  if (cb) {
    return cb();
  }
};

Reporting.prototype.logMessage = function(topic, msg, cb) {
  msg._ts = new Date().getTime();
  msg._mn = this.msgNum();
  msg._ho = this.config.host;
  msg._cl = this.config.cluster;
  var self = this;
  async.parallel([
    function(callback) {
      self.logMessageToMBaaS(topic, msg, callback);
    },
    function(callback) {
      self.logMessageToOs2(topic,msg,callback);
    },
    function(callback) {
      self.logMessageToFile(topic, msg, callback);
    }
  ], function(err, results) {
    if (cb) {
      cb(err, results);
    }
  });
};

function validateConfig(config) {
  if (!config) {
    throw new Error("Invalid config");
  }
  if (!config.host) {
    throw new Error("Invalid config: no host");
  }
  if (!config.cluster) {
    throw new Error("Invalid config: no cluster");
  }
}

var reportingutils = {
  generateID: function(message) {
    return reportingutils.MD5(JSON.stringify(message)) + "_" + reportingutils.getDatePart(message);
  },

  prefixZeroIfReq: function(val) {
    val = val.toString();
    return val.length > 1 ? val : '0' + val;
  },

  parseMonth: function(month) {
    return reportingutils.prefixZeroIfReq(month + 1);
  },

  parseDate: function(date) {
    return reportingutils.prefixZeroIfReq(date);
  },

  toYYYYMMDD: function(ts) {
    var tsDate = new Date(ts);
    var ret = tsDate.getFullYear() + reportingutils.parseMonth(tsDate.getMonth()) + reportingutils.parseDate(tsDate.getDate());
    return ret;
  },

  getDefaultDateForMessage: function() {
    return 0;
  },

  getDatePart: function(msg) {
    var ts = (msg._ts)?msg._ts:reportingutils.getDefaultDateForMessage();
    return reportingutils.toYYYYMMDD(ts);
  },

  MD5: function(str) {
    return crypto.createHash('md5').update(str).digest('hex');
  }
};

exports.reportingutils = reportingutils;
