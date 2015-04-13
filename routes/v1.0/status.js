var async = require("async");
var object = undefined;

var Status = function () {
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

    app.get("/"+version+"/status/:channel_id", requestGet);
    app.post("/"+version+"/status/:channel_id", requestGet);
  };

  var display = function (data, callback) {
    if (data.request.body && data.request.body["content-type-requested"] == 'json') {
//      data.resource.setHeader('Access-Control-Allow-Origin', 'https://example.com');
      data.resource.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      data.resource.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
      data.resource.setHeader('Access-Control-Allow-Credentials', true);
      data.resource.setHeader('Content-Type', 'application/json');
      data.resource.send(data.data);
    } else {
      var str = data.data.status + ' - ' + data.data.message;
      data.resource.send(str);
    }
    return callback(null, null);    
  };

  this.get = function (data, callback) {
    var channel = {};
    var channels = channelsManager.channels;
    
    if (!(data.request.params && data.request.params.channel_id)) {
      data.data = {status: "CRITICAL", message: "no params"};
      return display(data, callback);
    }
    var channel_id = data.request.params.channel_id;

    for (var i = 0; i < channels.length; i++) {
      if (channels[i].id == data.request.params.channel_id) {
        channel = channels[i].main_profile.display();
      }
    }

    if (!(channel.profiles instanceof Array)) {
      data.data = { channel_id: channel_id, status: "CRITICAL", message: "Channel id cannot be found, id requested:" + channel_id};
      return display(data, callback);
    }    
    if (channel.profiles.length < 1) {
  
      data.data = { channel_id: channel_id, status: "CRITICAL", message: "No profile present, live (" + channel.id + ") : " + channel.label};
      return display(data, callback);
    }

    for (var i = 0; i < channel.profiles.length; i++) {
      var profile = channel.profiles[i];
      if (!(profile.segments instanceof Array)) {
        data.data = { channel_id: channel_id, status: "CRITICAL", message: "Segment is not an Array, live (" + channel.id + ") : " + channel.label + ", profile_id :" + profile.id};
        return display(data, callback);
      }
      if (profile.segments.length < 1) {
        data.data = { channel_id: channel_id, status: "CRITICAL", message: "No segment present, live (" + channel.id + ") : " + channel.label + ", profile_id :" + profile.id};
        return display(data, callback);
      }

      for (var j = 0; j < profile.segments.length; j++) {
        var segment = profile.segments[i];
        if (segment.http_code != 200) {
          data.data = { channel_id: channel_id, status: "CRITICAL", message: "Segment http_code 404, live (" + channel.id + ") : " + channel.label + ", profile_id :" + profile.id + ", segment url :" + segment.url};
          return display(data, callback);
        }
        if (segment.size != null && segment.size < 1000) {
          console.log(segment);
          data.data = { channel_id: channel_id, status: "CRITICAL", message: "Segment size < 1000, live  (" + channel.id + ") : " + channel.label + ", profile_id :" + profile.id + ", segment url :" + segment.url};
          return display(data, callback);
        }
      }
    }

    data.data = { channel_id: channel_id, message: "Live : " + channel.label, status: "OK" };
    return display(data, callback);
  };


  /******************  |
  |  *** Requests ***  |
  |  ******************/

var requestGet = function (request, resource) {
  self.get({request: request, resource: resource}, function (err, data) {
    if (err) return resource.send({ channel_id: channel_id, status: 'error', code: err.code, message: err.message});
    console.log("This is the really end");
    return ;
  });
};


};

var getter = function() {
  if (!object) {
    object = new Status();
    return object;
  } else {
    return object;
  }
};

module.exports.get = getter;
