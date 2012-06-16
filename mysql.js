mysql = new require('mysql').createClient({
  host: process.env.DEPLOYFU_MYSQL_HOST == null ? '127.0.0.1' : process.env.DEPLOYFU_MYSQL_HOST,
  user: process.env.DEPLOYFU_MYSQL_USER == null ? 'root' : process.env.DEPLOYFU_MYSQL_USER,
  password: process.env.DEPLOYFU_MYSQL_PASSWORD == null ? '' : process.env.DEPLOYFU_MYSQL_PASSWORD,
  database: process.env.DEPLOYFU_MYSQL_DATABASE == null ? 'jenkinsmanifest' : process.env.DEPLOYFU_MYSQL_DATABASE
});

exports.mysql = mysql;