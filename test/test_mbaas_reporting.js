var proxy = require('proxyquire');
var sinon = require('sinon');
var assert = require('assert');
var async = require('async');
var util = require('util');
process.env.NO_FLUSH_TIMER = true;
exports.test_accept_message_sends_after_n_messages = function (finish){

  var syncBatch = sinon.stub();
  var mocks = {
    'fh-mbaas-client':{
      "app":{
        "message":{}
      }
    },
    './sync':function (){
      return{
        syncBatch: syncBatch
      };
    }
  };

  syncBatch.callsArg(1);
  var mbaasRep = proxy('../lib/mbaas-reporting',mocks);
  mbaasRep = new mbaasRep();
  var calls = [];
  //on the 16 message it will send the previous 15
  for(var i=0; i < 16; i++){
    calls.push(function (callback){
      mbaasRep.acceptMessage("fhact",{},function (err){
        assert.ok(!err, "did not expect an error ",err);
        callback();
      });
    });
  }
  async.parallel(calls,function done(){
    assert.ok(syncBatch.calledOnce,"expected sendBatch to be called");
    finish();
  });
};



exports.test_accept_message_does_not_send_before_n_messages = function (finish){

  var syncBatch = sinon.stub();
  var mocks = {
    'fh-mbaas-client':{
      "app":{
        "message":{}
      }
    },
    './sync':function (){
      return{
        syncBatch: syncBatch
      };
    }
  };

  syncBatch.callsArg(1);
  var mbaasRep = proxy('../lib/mbaas-reporting',mocks);
  mbaasRep = new mbaasRep();
  var calls = [];
  for(var i=0; i < 15; i++){
    calls.push(function (callback){
      mbaasRep.acceptMessage("fhact",{},function (err){
        assert.ok(! err, "did not expect an error");
        callback();
      });
    });
  }
  async.parallel(calls,function done(){
    assert.ok(! syncBatch.calledOnce,"expected sendBatch not to be called");
    finish();
  });
};

exports.expect_batch_to_be_reset_called_after_sync_done = function (finish){
  var syncBatch = sinon.stub();
  var mocks = {
    'fh-mbaas-client':{
      "app":{
        "message":{}
      }
    },
    './sync':function (){
      return{
        syncBatch: syncBatch
      };
    }
  };


  syncBatch.callsArg(1);

  var mbaasRep = proxy('../lib/mbaas-reporting',mocks);
  mbaasRep = new mbaasRep();
  var calls = [];
  //on the 11 message it will send the previous 15
  for(var i=0; i < 16; i++){
    calls.push(function (callback){
      mbaasRep.acceptMessage("fhact",{},function (err,ok){
        callback();
      });
    });
  }
  async.parallel(calls,function done(){
    assert.ok(syncBatch.calledOnce,"expected sendBatch to be called");
    var batch = mbaasRep.getBatch();
    assert.ok(batch.length === 1);  //one because the 16 message is added as the first message of the new batch
    finish();
  });
};


exports.expect_add_to_batch_to_be_called_after_sync_error = function (finish){
  var syncBatch = sinon.stub();
  var resyncBatch = sinon.stub();
  var mocks = {
    'fh-mbaas-client':{
      "app":{
        "message":{}
      }
    },
    './sync':function (){
      return{
        syncBatch: syncBatch,
        requeueFailedBatch: resyncBatch
      };
    }
  };


  syncBatch.callsArgWith(1,{});

  var mbaasRep = proxy('../lib/mbaas-reporting',mocks);

  mbaasRep = new mbaasRep();

  var calls = [];
  //on the 11 message it will send the previous 15
  for(var i=0; i < 16; i++){
    calls.push(function (callback){
      mbaasRep.acceptMessage("fhact",{},function (){
        callback();
      });
    });
  }
  async.parallel(calls,function done(){
    assert.ok(syncBatch.calledOnce,"expected sendBatch to be called");
    assert.ok(resyncBatch.calledOnce, "expected resync batch to be called once");
    finish();

  });
};

exports.expect_envars_to_override_limits = function(finish){
  //note we use proxy quire to ensure the module is loaded fresh and can pickup the envvars
  process.env.FH_MESSAGING_BATCH_LIMIT = "20";
  process.env.FH_MESSAGING_RETRY_LIMIT = "10";
  process.env.FH_MESSAGING_INTERVAL = "1000";
  process.env.FH_MESSAGING_RETRY_INTERVAL = "2000";
  var rep = proxy('../lib/mbaas-reporting',{});
  var reporting = new rep();
  assert.equal(20 , reporting.getBatchLimit(),"expected values to match");
  assert.equal(10 , reporting.getRetryLimit(),"expected values to match");
  assert.equal(2000 , reporting.getRetryInterval(),"expected values to match");
  assert.equal(1000 , reporting.getFlushInterval(),"expected values to match");

  process.env.FH_MESSAGING_BATCH_LIMIT = "d20sd";
  rep = proxy('../lib/mbaas-reporting',{});
  reporting = new rep();
  //expect default value
  assert.equal(15 , reporting.getBatchLimit(),"expected default value");

  //clean the env

  delete process.env.FH_MESSAGING_BATCH_LIMIT;
  delete process.env.FH_MESSAGING_RETRY_LIMIT;
  delete process.env.FH_MESSAGING_INTERVAL;
  delete process.env.FH_MESSAGING_RETRY_INTERVAL;

  finish();
};

exports.test_sync_interval = function(finish) {
  var clock = sinon.useFakeTimers();
  process.env.FH_MESSAGING_INTERVAL = 10*1000;
  process.env.FH_MESSAGING_RETRY_LIMIT = 5;
  delete process.env.NO_FLUSH_TIMER;

  var syncBatch = sinon.stub();
  var requestFailedBatch = sinon.spy();
  var mocks = {
    './sync':function (){
      return{
        syncBatch: syncBatch,
        requeueFailedBatch: requestFailedBatch
      };
    }
  };

  syncBatch.callsArgWith(1,{});
  var mbaasRep = proxy('../lib/mbaas-reporting',mocks);
  clock.tick(11*1000);
  assert.ok(requestFailedBatch.called);
  assert.ok(requestFailedBatch.calledWith(5));
  clock.restore();
  finish();
};
