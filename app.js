
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')


var express = require('express');
var http = require('http');
var url = require('url');
var collections = require('./collections');

var app = module.exports = express.createServer();

var get = function(urlStr, callback) {
 var u = url.parse(urlStr);
 http.get({ host: u.host, port: u.port, path: u.pathname + (u.search ? u.search : ''), headers: {'Accept': '*/*', 'User-Agent': 'curl'} },
   function(res) {
     var data = '';
     res.on('data', function(chunk) {
       data += chunk;
     }).on('end', function() {
       try {
         callback(null, data);
       }
       catch (err) {
         console.log('exception during get');
         console.log(err);
         callback(err);
       }
     });
   }).on('error', function(error){
     console.log('error during get');
     console.log(error);
     callback(error);
   });
}

var ajax = function(urlStr, callback) {
  get(urlStr, function(err, data) {
    if (err)
      callback(err);
    else
      callback(err, JSON.parse(data));
  })
}

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

var manifest;
var history;

function purger() {
  manifest = {
    version: 1,
    homepage: "http://www.cyanogenmod.com/",
    donate: "https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=3283920",
    roms: [
    ]
  }
  
  history = {};
  
  setTimeout(purger, 30 * 60 * 1000);
}
purger();

app.get('/manifest', function(req, res) {
  res.header('Cache-Control', 'max-age=300');
  res.send(manifest);
});

if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
}
if (typeof String.prototype.endsWith != 'function') {
  String.prototype.endsWith = function (str){
    return this.slice(-str.length) == str;
  };
}

function refresh() {
  ajax('http://jenkins.cyanogenmod.com/job/android/api/json', function(err, data) {
    setTimeout(refresh, 300000);
    if (err)
      return;
    collections.each(data.builds, function(index, build) {
      if (history[build.number]) {
        console.log(build.number + ": already processed.");
        return;
      }
      ajax(build.url + 'api/json', function(err, data) {
        if (err)
          return;
        var found = false;
        var entry = {
        };
        var zip;
        var buildData;
        collections.each(data.artifacts, function(index, artifact) {
          if (artifact.displayPath.startsWith('update-') && artifact.displayPath.endsWith('.zip')) {
            zip = artifact.displayPath;
            entry.url = 'http://get.cm/get/artifacts/' + build.number + '/artifact/archive/' + artifact.displayPath;
            return;
          }
          
          if (artifact.displayPath != 'build.prop')
            return;

          found = true;
          ajax(build.url + 'api/json', function(err, data) {
            buildData = data;
            if (err)
              return;
            if (data.result != 'SUCCESS') {
              if (data.result != null) {
                console.log(build.number + ": " + data.result);
                history[build.number] = build;
              }
              else {
                console.log(build.number + ": in progress");
              }
              return;
            }

            get(build.url + 'artifact/archive/build.prop', function(err, data) {
              if (err)
                return;
              history[build.number] = buildData;
              var lines = data.split('\n');
              var version;
              collections.each(lines, function(index, line) {
                var pair = line.split('=', 2);
                if (pair.length != 2)
                  return;
                var key = pair[0];
                var value = pair[1];
                if (key == 'ro.modversion') {
                  entry.modversion = value;
                  version = value.split('-');
                  version.pop();
                  version.pop();
                  entry.name = 'CyanogenMod ' + version.join(' ');
                  entry.name = entry.name.replace('CyanogenMod CyanogenMod', 'CyanogenMod');
                  if (version[1].indexOf('.') != -1)
                    entry.incremental = version[1].replace('.', '') * 10;
                  else
                    entry.incremental = version[1];
                  entry.product = 'cm-' + version[0];
                  if (entry.product == 'cm-9') {
                    entry.addons = [
                        {
                            "name": "Google Apps",
                            "url": "http://download2.clockworkmod.com/gapps/gapps-ics-20120304-signed.zip"
                        }
                    ]
                  }
                  else {
                    entry.addons = [
                    {
                        "name": "Google Apps",
                        "url": "http://download2.clockworkmod.com/gapps/gapps-gb-20110828-signed.zip"
                    },
                    {
                        "name": "GTalk w/ Video Chat (Experimental!)",
                        "url": "http://download2.clockworkmod.com/gapps/gapps-gb-20110828-newtalk-signed.zip"
                    }
                    ]
                  }
                }
                if (key == 'ro.product.device')
                  entry.device = value;

              });

              if (entry.device && entry.incremental) {
                buildData.zip = zip;
                entry.build = build.number;
                console.log(build.number + ": " + entry.url);
                entry.summary = 'Build: ' + version[1];
                manifest.roms.push(entry);
                manifest.roms = collections.sort(manifest.roms, function(r) {
                  return r.incremental;
                });
                manifest.roms.reverse();
                collections.each(buildData.actions, function(index, p) {
                  if (p.parameters) {
                    collections.each(p.parameters, function(index, p) {
                      if (p.name == 'RELEASE_TYPE') {
                        buildData.type = p.value;
                      }
                    });
                  }
                });
              }
              else {
                history[build.number] = build;
                console.log(build.number + ": missing build.prop entries");
              }
            });

          });
        });
        if (!found) {
          console.log(build.number + ": missing artifacts");
          history[build.number] = data;
          return;
        }
      });
    });
  });
}

refresh();

function renderList(req, res, currentDevice) {
  var devices = {};
  collections.each(manifest.roms, function(index, rom) {
    devices[rom.device] = true;
  });
  
  devices = Object.keys(devices);
  
  collections.sort(manifest.roms, function(v) {
    return v.build;
  });
  
  manifest.roms.reverse();
  
  res.render('index', {
    currentDevice: currentDevice,
    devices: devices,
    manifest: manifest,
    history: history
  });
}

app.get('/', function(req, res) {
  renderList(req, res);
});

app.get('/device/:device', function(req, res) {
  renderList(req, res, req.params.device);
});

var listenPort = process.env.PORT == null ? 3000 : parseInt(process.env.PORT);
app.listen(listenPort);
console.log('Express app started on port ' + listenPort);

