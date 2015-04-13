var MainProfile = require("./MainProfile.js");

var async = require("async");
var logger = require("node-wrapper/logger");
var Http = require('node-wrapper/http.js');

module.exports = function () {
  var self = this;
  this.channels = [];
  this.config = {};

  this.retrieveChannels = function (data, callback) {

    if (self.channels > 0) return callback();

    var formatData = function (callback) {
      self.channels = [];
      if (!('channels' in self.config)) debug._warn("There is no channel list on config file, check documentation");
      
      for (var i = 0; i < self.config.channels.length; i++) {
        (function (i, channel) {
          channel.id = (channel.id) ? channel.id :  i;
          channel.config = self.config;
          channel.channels = self.channels;
          self.channels.push(channel);
        })(i, self.config.channels[i]);
      }
      return callback();
    }; 

    var jobs = [formatData];
    return async.waterfall(jobs, function (err) {
      if (err) return callback(err);
      return callback();
    });
  };

  this.start = function (data, callback) {
    self.config = data.config;
    var retrieveChannels = function (callback) {
      return self.retrieveChannels(null, callback);
    };

    var start = function (callback) {
      for (var i = 0; i < self.channels.length; i++) {
        main_profile = new MainProfile(self.channels[i]);
        main_profile.init();
        main_profile.start();
        self.channels[i].main_profile = main_profile;
      }
    }

    var jobs = [retrieveChannels, start];
    async.waterfall(jobs, function (err, results) {
      if (err) return callback(err);
      return callback(null, channels);
    });
  }
}

