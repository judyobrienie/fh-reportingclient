var proxy = require('proxyquire');
var assert = require('assert');
var UNDER_TEST = '../../lib/sync';

module.exports.test_mbaas_client_init_with_correct_value = function (finish) {
  process.env.FH_INSTANCE = "test instance";
  process.env.FH_DOMAIN = "domain";
  process.env.FH_ENV = "test";
  process.env.FH_MBAAS_HOST = "testhost";
  process.env.FH_MBAAS_ENV_ACCESS_KEY = "accesskey";
  process.env.FH_APP_API_KEY = "apikey";
  process.env.FH_WIDGET = "project";
  process.env.FH_MBAAS_PROTOCOL = 'https';
  var mocks = {
    'fh-mbaas-client': {
      "app": {
        "message": {
          sendbatch: function (params,cb) {
            console.log("send batch ", params);
            assert.ok(params.domain === "domain");
            assert.ok(params.environment === "test");
            assert.ok(Array.isArray(params.data),"expected an array");
            cb();
          }
        }
      },
      "initEnvironment": function (env, params) {
        assert.ok(env === "test");
        assert.ok(params.accessKey === "accesskey");
        assert.ok(params.app === "test instance");
        assert.ok(params.project === "project");
        assert.ok(params.url === "https://testhost/");

      }

    }
  };

  var sync = proxy(UNDER_TEST,mocks);

  sync().syncBatch([{}],function (err){
     finish();
  });
};

