var async = require("async");
var object = undefined;

var Channels = function () {
  var debug;
  var app;
  var objects;
  var version;
  var self = this;
  var channels = [];

  this.load = function (data){
    debug = data.debug;
    app = data.app;
    objects = data.objects;
    version = data.version;
    channelsManager = data.channelsManager;

    app.get("/"+version+"/channels", requestGet);
    app.get("/"+version+"/channels/:channel_id", requestGet);
  };

  this.get = function (data, callback) {
    channelsLocal = [];
    
    var channels = channelsManager.channels;

    if (data.request.params && data.request.params.channel_id) {
      for (var i = 0; i < channels.length; i++) {
        if (channels[i].id == data.request.params.channel_id) {
          channelsLocal.push(channels[i]);
        }
      }
    } else channelsLocal = channels;

    return async.map(channelsLocal, function (channel, callback) {
      var data = channel.main_profile.display();
      callback(null, data);
    }, function (err, results) {
      if (err) return callback(err);
      return callback(null, results);
    });
  };


  /******************  |
  |  *** Requests ***  |
  |  ******************/

  var requestGet = function (request, resource) {
    self.get({request: request, resource: resource}, function (err, data) {
      if (err) return resource.send({status: 'error', code: err.code, message: err.message});
      return resource.send({status: 'ok', code: 200, data: data});
    });
  };


};

var getter = function() {
  if (!object) {
    object = new Channels();
    return object;
  } else {
    return object;
  }
};

module.exports.get = getter;
