//Requirements
var express = require('express');
var mysql = require('promise-mysql');
var connection;

//Initialization
var app = express();
app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public')); 
mysql.createConnection(process.env.DATABASE_URL).then(function(conn){
    connection = conn;
}).error(function(e){
    console.log(process.env.DATABASE_URL)
    process.exit()
});

//Routes
app.get('/', function(request, response) {
    connection.query('SELECT "Hello, world!" AS solution')
    .then(function(rows,fields) {
        response.send(rows[0].solution)
    })
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});