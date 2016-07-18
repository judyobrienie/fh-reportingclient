var GUID = process.env.FH_INSTANCE;
var DOMAIN = process.env.FH_DOMAIN;
var ENVIRONMENT = process.env.FH_ENV;
var HOST = process.env.FH_MBAAS_HOST;
var ACCESS_KEY = process.env.FH_MBAAS_ENV_ACCESS_KEY;
var API_KEY = process.env.FH_APP_API_KEY;
var PROJECT = process.env.FH_WIDGET;
var PROTOCOL = process.env.FH_MBAAS_PROTOCOL || 'https';
var MBaaSClient = require('fh-mbaas-client');
var URL = require('url');
var async = require('async');

//responsible for syncing messages to mbaas. Has a retry option
module.exports = function sync() {

  //requeue the send of messages on failure. stopping after times or first success
  function reqeueBatch(times,interval,batch) {
    async.retry({times: times, interval: interval}, function(cb) {
      syncBatch(batch,cb);
    }, function done(err) {
      if (err) {
        console.error("failed to sync message batch ", err);
      }
    });
  }

  //send data to fhmbaas
  function syncBatch(batch, cb) {
    if (batch && batch.length > 0) {
      MBaaSClient.initEnvironment(ENVIRONMENT, {
        url: URL.format(PROTOCOL + '://' + HOST),
        accessKey: ACCESS_KEY,
        project: PROJECT,
        app: GUID,
        appApiKey: API_KEY
      });
      // /api/app/:domain/:environment/:projectid/:appid/message/:topic with [] or messages for data (a batch)
      MBaaSClient.app.message.sendbatch({
        'host': HOST,
        'environment': ENVIRONMENT,
        'domain': DOMAIN,
        'data': batch,
        'topic': 'fhact' //the only other topic is fhweb which is not longer used
      }, function(err) {
        if (err) {
          return cb(err, {message: 'Error sending message batch to MBaaS'});
        } else {
          return cb(undefined, {message: 'Batch sent to MBaaS'});
        }
      });
    } else {
      return cb(undefined, {message: 'Batch empty...nothing to sync at this time'});
    }
  }

  return {
    "requeueFailedBatch": reqeueBatch,
    "syncBatch":syncBatch
  };
};


