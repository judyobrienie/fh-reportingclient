fh-reportingclient -- The FeedHenry Reporting Client
===============================================

## DESCRIPTION

The Feedhenry Reporting Client is a client library for Node.js applications that allows messages to be sent to a Feedhenry Reporting Server. (Formerly called a Messaging Server)

There's currently only one function available:

* `logMessage(topic, msg, callback)` - log messages for a particular topic

## Dependencies

The Reporting Client currently relies on the following being installed on a host:

* node.js

* npm (the Node Package Manager)

The Reporting Client currently operates it 2 ways:

1. send a message to the Reporting Server for storage. (And eventual aggregation into a metrics report)
2. save the message in a file. (Which is expected to be batch imported into the Reporting Server, similar to the way that Millicore is currently operating) 

## Installation

The Reporting Client is deployed by adding a dependency to your projects package.json file.

## Running and Configuration  

To use the Reporting Client you should add a dependency in your project to the latest build of fh-reportingclient.
Within the code of your application, require the module, call the constructor - passing appropriate values, then call the `logMessage()` function where you want to log a message.

If there are errors sending to msgServer, the message will be saved to recoveryfile.  Messages are always sent to msgServer and backupFile.  If any or all of msgServer, recoveryFiles, backupFiles are not present in the config, the library will not attempt to send messages there, e.g. if msgServer is specifed, but not recoveryFiles or backupFiles, then the library will attempt to sen the message to the message server, but not save it to disk.

The parameters, "host" and "cluster", must be specified

Example:

    var reporting = require('fh-reporting');
    var config = {
      host: "dub1app1b",
      cluster: "dub1",
      msgServer: {
        logMessageURL: "http://some_internet_reporting_server_address:443/msg/TOPIC"
      },
      recoveryFiles: {
        fileName: "/mnt/some/path/recoveryFiles.log"
      },
      backupFiles: {
        fileName: "/mnt/some/path/backupMessages.log"
      }
    };

    var reportingClient = new reporting.Reporting(config);

    reportingClient.logMessage("topicHello", {id: 27, text: "Hello World"});

    // if desired a callback can be passed to accept results, but this will be of limited use to most applications
    reportingClient.logMessage("topicHello", {id: 27, text: "Hello World"} , function (err, results) {
      console.log("results: " + results[0].handler + ", " + results[0].result.body);
    });