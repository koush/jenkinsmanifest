mysql = require('./mysql').mysql;

exports.set = function(name, value) {
    mysql.query('insert into settings (name, value) values (?, ?) on duplicate key update value=?', [name, value, value]);
}

exports.get = function(name, cb) {
    mysql.query('select * from settings where name=?', [name],
    function(err, results, fields) {
        if (err)
          cb(null);
        else if (results.length == 0)
          cb(null);
        else
          cb(results[0].value);
    });
}

