var async                 = require("async");
var http                  = require("http");
var https                 = require("https");
var logger                = require("node-wrapper/logger");
var url                   = require("url");
var path                  = require("path");
var request               = require("request");
var merge                 = require("merge");
var qs                    = require("qs");

var Segment = function (data) {
  var self                = this;

  this.id                 = data.id;
  this.profile            = data.profile;
  this.url                = url.parse(data.url);
  this.length             = data.length;
  this.http_code          = null;
  this.size               = null;
  this.config             = data.config;

  var segments            = [];
  var debug               = null;

  /* Guess url */
  if (!self.url.host) {
    self.url = url.parse(url.resolve(self.profile.url.format(), self.url.format()));
  }

  /* add ?nostat=1 */
  var query = qs.parse(self.url.query);
  self.url.search = "?" + qs.stringify(merge(query, {"nostat": 1}));
  self.url = url.parse(url.format(self.url));

  this.init = function(callback){
    self.debug = logger.create("segment " + self.profile.channel.label + "#" + self.profile.id + ':' + self.id);
    if (callback) return callback(null, null);
  };

  this.update = function (data, callback) {
    self.requestHead(data, callback);
  }

  this.requestGet = function (data, callback) {
    self.debug._debug("update segment", self.url.href);
    var options = {url: self.url.format()};
    if (self.config.headers) options.headers = self.config.headers;

    return request(options, function (error, response, body) {
      if (error) return callback(err);
      
      self.http_code = response.statusCode;
      self.size = response.headers['content-length'];
      self.debug._debug("end update segment", self.url.href);
      return (callback) ? callback(null, "ok") : null;
    });    
  }

  this.requestHead = function (data, callback) {
    var options = {url: url.format(self.url)};
    if (self.config.headers) options.headers = self.config.headers;
    self.debug._debug("update segment", options.url);

    return request.head(options, function (error, response, body) {
      if (error) return callback(err);
      
      self.http_code = response.statusCode;
      self.size = response.headers['content-length'];
      self.debug._debug("end update segment", self.url.href);
      return (callback) ? callback(null, "ok") : null;
    });    
  }

  this.http = function (data, callback) {
    self.debug._debug("update segment", self.url.href);
    if ('user_agent' in self.config) self.url.headers = { 'User-Agent': self.config.user_agent };
    
    var bytes = 0;
    return (self.url.protocol == 'https:' ? https : http).get(self.url, function (response) {
      var raws = "";
      self.http_code = response.statusCode;

      response.on('data', function (raw) {
        bytes += raw.length;
      });
      response.on('end', function () {
        self.size = bytes;
        self.debug._debug("end update segment", self.url.href);
        return (callback) ? callback(null, "ok") : null;
      });
    }).on("error", function (err) {
        return (callback) ? callback(null, "ok") : null;
    });
  };

  this.delete = function (data, callback) {
    if (callback) return callback(null, "ok");
  };

  this.display = function () {
    return {http_code: self.http_code, url: self.url.format(), size: self.size, length: self.length};
  };
};

module.exports = Segment;
