var async           = require("async");
var http            = require("http");
var https           = require("https");
var logger          = require("node-wrapper/logger");
var util            = require("util");
var url_module      = require("url");

var Profile         = require("./Profile.js")

var MainProfile = function (data) {
  var self                = this;

  this.id                  = data.id;
  this.url                 = data.url;
  this.label               = data.label;
  this.debug               = null;
  this.config              = data.config;
  this.profiles            = []; /* All (Profile) profiles to this channel */
  this.channels            = data.channels; /* All (MainProfile) channels */

  var last_profile_id     = 0;
  var timeout             = null;

  /* Const */
  const regex_header = /^#EXT-X-STREAM-INF\s*:\s*PROGRAM-ID\s*=\s*[1-9]+\s*,\s*BANDWIDTH\s*=\s*(.*),*.*$/;

  this.init = function(callback){
    self.debug     = logger.create("live " + self.label);
    
    if (callback) return callback();
  };

  this.start = function (data, callback) {
    self.debug._debug("start");
    return self.update(null, function (err, results) {
      if (err) return callback(err);

      if (callback) return callback();
    });
  };

  this.update = function (data, callback) {
    var fetchM3u8 = function (callback) {
      var opt = url_module.parse(self.url);
      if ('user_agent' in self.config) opt.headers = { 'User-Agent': self.config.user_agent };

      return (opt.protocol == 'https:' ? https : http).get(opt, function (response) {
        var raws = "";
        response.setEncoding('utf8');

        response.on('data', function (raw) {
          raws += raw.toString();
        });
        response.on('end', function () {
          var lines = raws.split(/\r?\n/);
          
          return callback(null, {lines: lines});
        });
      }).on("error", function (err) {
        return callback(err);
      });
    };

    var updateMainProfile = function (data, callback) {
      var lines = data.lines;
      var data = {profiles: []};
      for (var i = 0; i < lines.length; i++) {
        var headerMatches = regex_header.exec(lines[i]);
        if (!headerMatches) continue;

        var url = lines[++i];
        var bandwidth = headerMatches[1];

        (function (i, url, bandwidth) {
          options = { id: -1
                      , channel: self
                      , channels: self.channels
                      , profiles: self.profiles
                      , bandwidth: bandwidth
                      , url: url
                      , config: self.config};
          var profile = new Profile(options);
          data.profiles.push(profile);
        })(i, url, bandwidth);
      }

      return callback(null, data);
    };

    var removeProfiles = function (data, callback) {
      data.oldProfile = [];

      for (var i = 0; i < self.profiles.length; i++) {
        var found = false;
        for (var j = 0; j < data.profiles.length; j++) {
          if (self.profiles[i].url.href == data.profiles[j].url.href) {
            found = true;
            break;
          }
        }
        if (!found) {
          var profile = self.profiles.splice(i, 1);
          profile.delete();
          profile = null;
        }
      }

      return callback(null, data);
    };

    var addProfiles = function (data, callback) {
      var exist;
      for (var i = 0; i < data.profiles.length; i++) {
        exist = false;
        for (var j = 0; j < self.profiles.length; j++) {
          if (self.profiles[j].url.href == data.profiles[i].url.href) {
            exist = true;
          }
        }
        if (!exist) {
          data.profiles[i].id = last_profile_id++;
          data.profiles[i].init();
          self.profiles.push(data.profiles[i]);
        }
      }

      return callback();
    };

    var startProfiles = function (callback) {
      async.map(self.profiles, function (profile, callback) {
        /* warning, we should start only new profiles */
        profile.start(null, function (err, results) {
          if (err) return callback(err);
          return callback();
        });
      }, function (err, results) {
        if (err) return callback(err);
        return callback();
      });
    };

    var createTimeout = function (callback) {
      var time = 60;
      
      timeout = setTimeout(function () {
        self.update(function (err, results) {
          if (err) return self.debug._warn(err);
          return ;
        });
      }, time * 1000);
      return callback();
    };
    
    var jobs = [fetchM3u8, updateMainProfile, removeProfiles, addProfiles, startProfiles, createTimeout];
    var jobs = [fetchM3u8, updateMainProfile, removeProfiles, addProfiles, startProfiles];
    async.waterfall(jobs, function (err, results) {
      if (err) return callback(err);
      
      if (callback) return callback(null, null);
    });
  };

  this.stop = function (data, callback) {
    self.debug._debug("stop");
    if (timeout) clearTimeout(timeout);
    
    if (callback) return callback(null, null);
  };

  this.delete = function (data, callback) {
    self.debug._debug("delete");
    self.stop();
    for (var i = 0; i < self.profiles.length; i++) {
      (function (profile, i) { 
        profile.delete(function (err, results) {
          if (err) return callback(err);
          self.profiles.splice(i, 1);
        });
      })(self.profiles[i], i);
    }
  };

  this.display = function (callback) {
    var data = {};
    data.profiles = [];
    for (var i = 0; i < self.profiles.length; i++) {
      data.profiles.push(self.profiles[i].display());
    }
    data.id = self.id;
    data.label = self.label;
    return data;
  };

};


module.exports = MainProfile;
