//Requirements
var express = require('express')
var app = express()
var api = require('./api.js')
var bodyParser = require('body-parser');

//Initialization
var sessionStore
app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public')); 
app.use(bodyParser.json())
api.init(app,function(connection) {
    app.listen(app.get('port'), function() {
        console.log('Node app is running on port', app.get('port'));
    });
})