
/**
 * Module dependencies.
 */

var http            = require('http');
var path            = require('path');
var express         = require('express');
var fs              = require('fs');
var logger          = require("node-wrapper/logger");

var routes          = require('./routes');
var ChannelsManager = require("./libs/ChannelsManager.js");
//var oauth = require("./libs/Oauth.js").getObject();

var debug = logger.create("core");
try {
  var config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch (e) {
  if ('code' in e && e.code == 'ENOENT') debug._error('./config.json file is missing');
  else debug._error(e);
  process.exit();
}

if (config.methodOutput)
  logger.setMethodOutput(config.methodOutput);

var channelsManager = new ChannelsManager();

channelsManager.start({config: config}, function (err, data) {
  if (err) debug._error(err);
  process.exit();
});

var objects =
  { "v1.0" :
    { status : require('./routes/v1.0/status').get()
      , channelsRoute : require('./routes/v1.0/channels').get()
    }
  };

setInterval(function () {
    debug._debug("getActiveHandles", process._getActiveHandles().length, "getActiveRequests", process._getActiveRequests().length)
}, 1000);

var app = express();

// all environments
app.set('port', process.env.PORT || process.argv[2]);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
//app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(require('express-method-override')('method_override_param_name'));
app.use(function (req, res, next) {
  debug._log(req.method + ':' + req.originalUrl);
  next();
});
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}


app.get('/', routes.index);

for (var versionKey in objects) {
  var versionObjects = objects[versionKey];

  for (var objectName in versionObjects) {
    var object = versionObjects[objectName];

    var debugKey = "route:" + versionKey + ":" + objectName;
    var data = { app: app
                 , debug: logger.create(debugKey)
                 , objects: objects
                 , version: versionKey
                 , channelsManager: channelsManager
               };
    object.load(data);
  }
}

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});


