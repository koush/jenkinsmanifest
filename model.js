sprintf = require('sprintf').sprintf;
mysql = require('./mysql').mysql;
setting = require('./setting');

setting.get('model_version', function(version) {
  if (version == null) {
    mysql.query('create table if not exists settings (name varchar(32) primary key not null, value varchar(256))');
    
    mysql.query('create table if not exists releases (build int primary key not null, modversion varchar(64)not null, device varchar(32) not null, filename varchar(256) not null, date bigint not null)');

    version = "1";
  }
  if (version == "1") {
    mysql.query('alter table releases add column (releaseVersion varchar(32))');
    
    version = "2";
  }
  setting.set('model_version', version);
});

exports.mysql = mysql;
