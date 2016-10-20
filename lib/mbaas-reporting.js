// In-memory batch to hold the incoming messages
var batch = [];
var batchLimit = getEnvNumericalValue(process.env.FH_MESSAGING_BATCH_LIMIT,15);
var flushTimerInterval = getEnvNumericalValue(process.env.FH_MESSAGING_INTERVAL,5*60*1000);
var retryLimit = getEnvNumericalValue(process.env.FH_MESSAGING_RETRY_LIMIT,3);
var retryInterval = getEnvNumericalValue(process.env.FH_MESSAGING_RETRY_INTERVAL,5000);
var flushTimer;

//parse the value if it is present and if it is not NaN return that else return the default
function getEnvNumericalValue(envValue, defaultVal) {
  var limit = defaultVal;
  if (envValue) {
    limit = parseInt(envValue,10);
    if (isNaN(limit)) {
      limit = defaultVal;
    }
  }
  return limit;
}

//set up the sync with a retry limit
var sync = require('./sync')();

//set up our timed flush to flush every 5 minutes

(function initFlushTimer() {
  //useful for testing to make sure the test exits
  if (process.env.NO_FLUSH_TIMER) {
    return;
  }
  if (!flushTimer) {
    flushTimer = setInterval(
      function() {
        var readyBatch = cloneAndResetBatch();
        sync.syncBatch(readyBatch,function(err) {
          if (err) {
            sync.requeueFailedBatch(retryLimit,retryInterval,readyBatch);
          }
        });
      }, flushTimerInterval);
  }
}());

//this is called when the app crashes. It attempts to send any messages currently in memory. It does not retry on error as the app is crashing
MBaaSReporting.prototype.flushBatch = function() {
  sync.syncBatch(cloneAndResetBatch(),function() {});
};

//clone the batch and reset it in a synchronous manner so nothing new can be added until we are done.
function cloneAndResetBatch() {
  var cloned = batch.slice(0,batch.length);
  batch = [];
  return cloned;
}

MBaaSReporting.prototype.acceptMessage = function(topic, msg, cb) {
  var self = this;
  if (batch.length >= batchLimit) {
    var readyBatch = cloneAndResetBatch();
    sync.syncBatch(readyBatch,function(err) {
      if (err) {
        // if there is an error requeue the sync
        sync.requeueFailedBatch(retryLimit,retryInterval,readyBatch);
        return cb(err, { message: 'Error sending message batch to MBaaS. Will retry 3 more times' });
      } else {
        self.addToBatch(topic, msg);
        return cb(undefined, { message: 'New batch started' });
      }
    });
  } else {
    this.addToBatch(topic, msg);
    return cb();
  }
};

MBaaSReporting.prototype.addToBatch = function(topic, msg) {
  batch.push(msg);
};

MBaaSReporting.prototype.getBatch = function() {
  return batch;
};

MBaaSReporting.prototype.getBatchLimit = function() {
  return batchLimit;
};

MBaaSReporting.prototype.getRetryLimit = function() {
  return retryLimit;
};

MBaaSReporting.prototype.getRetryInterval = function() {
  return retryInterval;
};

MBaaSReporting.prototype.getFlushInterval = function() {
  return flushTimerInterval;
};

function MBaaSReporting() {}

/** Expose functionality */
module.exports = MBaaSReporting;
