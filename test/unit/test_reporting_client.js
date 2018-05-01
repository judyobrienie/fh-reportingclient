var proxy = require('proxyquire');
var assert = require('assert');

process.env.NO_FLUSH_TIMER = true;
function getConfig(realTime,mbaasType, decoupled, logMessageUrl,backupFile, recoveryFile){
  return {
    host:         "testhost" || '',
    cluster:      "testcluster" || '',
    realTimeLoggingEnabled: realTime,
    mbaasType: mbaasType,
    decoupled: decoupled ||  false,
    msgServer:    {
      logMessageURL: logMessageUrl
    },
    backupFiles:  {
      fileName: backupFile || ''
    },
    recoveryFiles:{
      fileName: recoveryFile | ''
    }
  };
}

exports.test_logMessageToMBaaS_ok_openshift3 = function (finish){
  var acceptCalled = false;
   var mockMbaasReporting = {
     './mbaas-reporting': function () {
        this.acceptMessage = function (topic,msg,cb){
            acceptCalled = true;
            console.log("accept message mock");
            assert.ok("fhact" === topic,"topic should be fhact");
            assert.ok(msg, "expected a message");
            cb();
          };
       }
  };

  var client = proxy('../../lib/fh-reporting',mockMbaasReporting);
  client = new client.Reporting(getConfig(true,"openshift3",true,"doesntmatter",null,null));
  client.logMessage("fhact",{"test":"test"}, function (err){
    assert.ok(!err, "did not expect an error");
    assert.ok(acceptCalled, "expected accept to be called");
    finish();
  });
};


exports.test_logMessageToMBaaS_ok_feedhenry = function (finish){
  var acceptCalled = false;
  var mockMbaasReporting = {
    './mbaas-reporting': function () {
        this.acceptMessage = function (topic,msg,cb){
          acceptCalled = true;
          assert.ok("fhact" === topic,"topic should be fhact");
          assert.ok(msg, "expected a message");
          cb();
        };
    }
  };
  var client = proxy('../../lib/fh-reporting',mockMbaasReporting);
  client = new client.Reporting(getConfig(true,"feedhenry",true,"doesntmatter",null,null));
  client.logMessage("fhact",{"test":"test"}, function (err){
    assert.ok(!err, "did not expect an error");
    finish();
  });
};


exports.test_no_logMessageToMBaaS_os2 = function (finish){
  var mockMbaasReporting = {
    './mbaas-reporting': function () {
        this.acceptMessage = function (topic,msg,cb){
          assert.fail("should not have got here");
        };
    },
    'request':function (params,cb){
      assert.ok(params.method === "POST");
      cb(undefined,{},{"test":"test"});
    }
  };
  var client = proxy('../../lib/fh-reporting',mockMbaasReporting);
  client = new client.Reporting(getConfig(true,"openshift",true,"doesntmatter",null,null));
  client.logMessage("fhact",{"test":"test"}, function (err){
    assert.ok(!err, "did not expect an error");
    finish();
  });
};



exports.test_no_logMessageToMBaaS_os3_real_time_not_enabled = function (finish){
  var mockMbaasReporting = {
    './mbaas-reporting': function () {
        this.acceptMessage = function (topic,msg,cb){
          assert.fail("should not have got here");
          cb();
        };
    }
  };
  var client = proxy('../../lib/fh-reporting',mockMbaasReporting);
  client = new client.Reporting(getConfig(false,"openshift3",true,"doesntmatter",null,null));
  client.logMessage("fhact",{"test":"test"}, function (err,res){
    assert.ok(!err, "did not expect an error");
    finish();
  });
};


exports.test_no_logMessageToMBaaS_feedhenry_real_time_not_enabled = function (finish){
  var mockMbaasReporting = {
    './mbaas-reporting': function () {

        this.acceptMessage  = function (topic,msg,cb){
          assert.fail("should not have got here");
          cb();
        };
    }
  };
  var client = proxy('../../lib/fh-reporting',mockMbaasReporting);
  client = new client.Reporting(getConfig(false,"feedhenry",true,"doesntmatter",null,null));
  client.logMessage("fhact",{"test":"test"}, function (err,res){
    assert.ok(!err, "did not expect an error");
    finish();
  });
};

exports.test_log_to_os2_real_time_enabled = function (finish){
  var url = "http://somewhere.com";
  var mockMbaasReporting = {
    './mbaas-reporting': function () {
      this.acceptMessage = function (topic,msg,cb){
        assert.fail("should not have got here");
        cb();
      };
    },
    'request':function (params,cb){
      assert.ok(params.uri === url,"expected url to match");
      assert.ok(params.method === "POST");
      cb(undefined,{},{"test":"test"});
    }
  };
  var client = proxy('../../lib/fh-reporting',mockMbaasReporting);
  client = new client.Reporting(getConfig(true,"openshift",false,url,null,null));
  client.logMessage("fhact",{"test":"test"}, function (err,res){
    res = res[1];
    assert.ok(!err, "did not expect an error");
    assert.ok(res.result,"expected a response");
    assert.ok(res.result.status === "ok","expected a response to be ok");
    assert.ok(res.result.info,"expected info");
    assert.ok(res.result.info.body.test === "test","expected body to match");
    finish();
  });
};


exports.test_no_log_to_02_openshift2_mbaas_real_time_not_enabled = function (finish){
  var url = "http://somewhere.com";
  var mockMbaasReporting = {
    './mbaas-reporting': function () {
      this.acceptMessage = function (topic,msg,cb){
        assert.fail("should not have got here");
      };
    },
    'request':function (params,cb){
        assert.fail("should not have got here");
    }
  };
  var client = proxy('../../lib/fh-reporting',mockMbaasReporting);
  client = new client.Reporting(getConfig(false,"openshift",false,url,null,null));
  client.logMessage("fhact",{"test":"test"}, function (err,res){
    assert.ok(! err,"did not expect an error");
    assert.ok(! res[0],"should not have a result");
    assert.ok(! res[1],"should not have a result");
    finish();
  });

};

exports.test_no_log_to_file_if_no_file_paths_provided_os2 = function (finish){
  var url = "http://somewhere.com";
  var client = proxy('../../lib/fh-reporting',{"fs":{
    "createWriteStream":function (){
      assert.fail("should not have called this");
    }
  }});
  client = new client.Reporting(getConfig(false,"openshift",false,url,null,null));
  client.logMessage("fhact",{"test":"test"}, function (err,res){
    assert.ok(! err,"did not expect an error");
    assert.ok(! res[0],"should not have a result");
    assert.ok(! res[1],"should not have a result");
    finish();
  });
};

exports.test_no_log_to_file_if_no_file_paths_provided_os3 = function (finish){
  var url = "http://somewhere.com";
  var client = proxy('../../lib/fh-reporting',{"fs":{
    "createWriteStream":function (){
      assert.fail("should not have called this");
    }
  }});
  client = new client.Reporting(getConfig(false,"openshift3",false,url,null,null));
  client.logMessage("fhact",{"test":"test"}, function (err,res){
    assert.ok(! err,"did not expect an error");
    finish();
  });
};

exports.test_no_log_to_file_if_no_file_paths_provided_feedhenry = function (finish){
  var url = "http://somewhere.com";
  var client = proxy('../../lib/fh-reporting',{"fs":{
    "createWriteStream":function (){
      assert.fail("should not have called this");
    }
  }});
  client = new client.Reporting(getConfig(false,"feedhenry",false,url,null,null));
  client.logMessage("fhact",{"test":"test"}, function (err,res){
    assert.ok(! err,"did not expect an error");
    finish();
  });
};


exports.test_log_to_file_if_file_paths_provided_feedhenry = function (finish){
  var url = "http://somewhere.com";
  var client = proxy('../../lib/fh-reporting',{"fs":{
    "createWriteStream":function (path,flags){
      assert.ok(path == "/tmp/backup", "path should be the same");
      assert.ok(flags,"expected flags");
    }
  }});
  client = new client.Reporting(getConfig(false,"feedhenry",false,url,"/tmp/backup","/tmp/recovery"));
  client.logMessage("fhact",{"test":"test"}, function (err,res){
    assert.ok(! err,"did not expect an error");
    finish();
  });
};

exports.testGenerateID = function(finish) {
  var reportingUtils = proxy('../../lib/fh-reporting',{}).reportingutils;
  var simpleObj = { one: 'one', two: 'two'};
  var simpleObjExpected = '4770861b901ee195bdb1e85791ae1b11_19700101';
  var simpleGeneratedId = reportingUtils.generateID(simpleObj);
  assert.strictEqual(simpleGeneratedId, simpleObjExpected, 'Generated simple ID did not match actual [' + simpleGeneratedId + '] expected [' + simpleObjExpected + ']');

  var timestampedObj = { _ts: new Date(1999, 11, 25, 13, 14, 15, 500).getTime(), one: 'one', two: 'two' }
  var timestampedObjExpected = '7be5c930326e1628ffbfd9c1afd20d71_19991225';
  var timestampedGeneratedId = reportingUtils.generateID(timestampedObj);
  assert.strictEqual(timestampedGeneratedId, timestampedObjExpected, 'Generated timestamped ID did not match actual [' + timestampedGeneratedId + '] expected [' + timestampedObjExpected + ']');
  finish()
};


exports.testConstructorValidation = function(finish) {
  var reporting = proxy('../../lib/fh-reporting',{});
  assert.throws(function () {new reporting.Reporting()});
  assert.throws(function () {new reporting.Reporting({})});
  assert.throws(function () {new reporting.Reporting({cluster:"clustername"})});
  assert.throws(function () {new reporting.Reporting({host:"hostname"})});
  assert.doesNotThrow(function () {new reporting.Reporting({host:"hostname",cluster:"clustername", msgServer:"hello"})});
  assert.doesNotThrow(function () {new reporting.Reporting({host:"hostname",cluster:"clustername", msgServer: {logMessageURL: "http://localhost:12345/msg/TOPIC"}})});
  assert.doesNotThrow(function () {new reporting.Reporting({host:"hostname",cluster:"clustername", msgServer: {logMessageURL: "http://localhost:12345/msg/TOPIC"}}, {info: function () {}})});
  finish();
};


