var async                      = require("async");
var url                        = require("url");
var logger                     = require("node-wrapper/logger");
var http                       = require("http");
var https                      = require("https");

var Segment                    = require("./Segment.js")

var Profile = function (data) {
  var self                = this;

  this.id                      = data.id;
  this.url                     = url.parse(data.url);
  this.debug                   = null;
  this.config                  = data.config;
  this.channel                 = data.channel;
  this.channels                = data.channels;
  this.profiles                = data.profiles;
  this.bandwitdh               = data.bandwidth;
  this.segments                = [];

  var ext_x_version            = null;
  var ext_x_allow_cache        = null;
  var ext_x_media_sequence     = null;
  var ext_x_targetduration     = null;

  var last_segment_id          = 0;

  var timeout                  = null;

  var lines_saved              = [];

  /* Const */
  const regexp_media_sequence  = /^#EXT-X-MEDIA_SEQUENCE:(.*)$/;
  const regexp_targetduration  = /^#EXT-X-TARGETDURATION:(.*)$/;
  const regexp_version         = /^#EXT-X-VERSION:(.*)$/;
  const regexp_allow_cache     = /^#EXT-X-ALLOW-CACHE:(.*)$/;
  const regexp_segment         = /^#EXTINF:(.*)$/;

  /* Guess url */
  if (!self.url.host) {
    var MainBaseUrl = path.dirname(self.channel.url.format());
    self.url = url.parse(url.resolve(MainBaseUrl, self.url.format()));
  }

  this.init = function(callback){
    debug = logger.create("profile " + self.channel.label + "#" + self.id);
    /**/debug._debug("init");/**/

    if (callback) return callback();
  };

  this.start = function (data, callback) {
    /**/debug._debug("start", url.parse(self.url));/**/
    return self.update(null, function (err, results) {
      if (err) return callback(err);

      return callback(null, "ok");
    });
  };

  this.update = function (data, callback) {
    var fetchM3u8 = function (callback) {
      if ('user_agent' in self.config) self.url.headers = { 'User-Agent': self.config.user_agent };

      return (self.url.protocol == 'https:' ? https : http).get(self.url, function (response) {
        var raws = "";
        response.setEncoding('utf8');

        response.on('data', function (raw) {
          raws += raw.toString();
        });
        response.on('end', function () {
          var lines = raws.split(/\r?\n/);

          lines_saved = lines
          return callback(null, {lines: lines});
        });
      }).on("error", function (err) {
        debug._error("Profile :", err);
        return callback(null, {lines: lines_saved});
      });
    };

    var updateProfile = function (data, callback) {
      var lines = data.lines;
      var data = {segments: []};
      for (var i = 0; i < lines.length; i++) {
        var matches;
        if (matches = regexp_segment.exec(lines[i])) {
          if (!matches) continue;
          var length = parseFloat(matches[1]);

          var options = { 
            id: -1
            , profile: self
            , length: length
            , url: lines[++i] + "?nostat=1" 
            , config: self.config
          };
          var segment = new Segment(options);
          data.segments.push(segment);
        } else if (matches = regexp_targetduration.exec(lines[i])) {
          if (matches && matches[1]) ext_x_targetduration = matches[1];
        } else if (matches = regexp_media_sequence.exec(lines[i])) {
          if (matches && matches[1]) ext_x_media_sequence = matches[1];
        } else if (matches = regexp_version.exec(lines[i])) {
          if (matches && matches[1]) ext_x_version = matches[1];
        } else if (matches = regexp_allow_cache.exec(lines[i])) {
          if (matches && matches[1]) ext_x_allow_cache = matches[1];
        }
      }

      return callback(null, data);
    };

    var removeSegments = function (data, callback) {
      data.oldSegment = [];

      for (var i = 0; i < self.segments.length; i++) {
        var found = false;
        for (var j = 0; j < data.segments.length; j++) {
          if (self.segments[i].url.href == data.segments[j].url.href) {
            found = true;
            break;
          }
        }
        if (!found) {
          /*/debug._debug("remove segment", segments[i].display().url);/**/
          var segment = self.segments.splice(i, 1);
          segment[0].delete();
          segment = null;
        }
      }

      return callback(null, data);
    };

    var addSegments = function (data, callback) {
      var exist;
      for (var i = 0; i < data.segments.length; i++) {
        exist = false;
        for (var j = 0; j < self.segments.length; j++) {
          if (self.segments[j].url.href == data.segments[i].url.href) {
            exist = true;
          }
        }
        if (!exist) {
/*/          debug._debug("add segment", data.segments[i].display().url);/**/
          data.segments[i].id = last_segment_id++;
          data.segments[i].init();
          self.segments.push(data.segments[i]);
          data.segments[i].update();
        }
      }

      return callback();
    };

    var updateSegments = function (callback) {
      async.map(self.segments, function (segment, callback) {
        segment.update(null, function (err, results) {
          if (err) return callback(err);
          return callback();
        });
      }, function (err, results) {
        if (err) return callback(err);
        return callback();
      });
    };

    var createTimeout = function (callback) {
      var time = 3;
      if (ext_x_targetduration > 2) time = ext_x_targetduration;
      
      timeout = setTimeout(function () {
        self.update(function (err, results) {
          if (err) return debug._warning(err);
//          return debug._log("update");
        });
      }, time * 1000);
      return callback();
    };
    
    var jobs = [fetchM3u8, updateProfile, removeSegments, addSegments, updateSegments, createTimeout];
    var jobs = [fetchM3u8, updateProfile, removeSegments, addSegments, createTimeout];
    async.waterfall(jobs, function (err, results) {
      if (err) return (callback) ? callback(null, null) : null;
      
      if (callback) return callback(null, null);
    });
  };

  this.stop = function (data, callback) {
    debug._debug("stop");
    if (timeout) clearTimeout(timeout);
    
    if (callback) return callback(null, null);
  };

  this.delete = function (data, callback) {
    self.stop();
    for (var i = 0; i < self.segments.length; i++) {
      (function (segment, i) {         
        segment.delete(function (err, results) {
          if (err) return callback(err);
          self.segments.splice(i, 1);
        });
      })(segments[i], i);
    }
  };

  this.display = function () {
    var data = {};
    data.segments = [];
    for (var i = 0; i < self.segments.length; i++) {
      data.segments.push(self.segments[i].display());
    }
    data.id = self.id;
    return data;
  }
};

module.exports = Profile;
