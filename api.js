var mysql = require('promise-mysql')
var bcrypt = require('bcrypt')
var session = require('express-session')
var MySQLStore = require('express-mysql-session')(session)
var connection;

function login(req,resp) {
    if (!req.body || !req.body.username || !req.body.password) {
        resp.sendStatus(403)
        return
    }
    var userid
    connection.query("SELECT Password, UserID FROM Users WHERE Username = ? LIMIT 1",[req.body.username])
    .then(function(results,fields) {
        if (results.length > 0) {
            userid = results[0].UserID
            return bcrypt.compare(req.body.password, results[0].Password)
        } else {
            return new Error()
        }
    })
    .then(function(res) {
        if (res) {
            req.session.userid = userid
            resp.sendStatus(200)
        } else {
            resp.sendStatus(403)
        }
    })
}

function logout(req, resp) {
    req.session.userid = undefined
    resp.sendStatus(200)
}

function createUser(req,resp) {
    if (!req.body || !req.body.username || !req.body.password || 
        typeof(req.body.canSolve) == 'undefined' || 
        typeof(req.body.canReview) == 'undefined') {
        resp.sendStatus(403)
        return
    }
    bcrypt.hash(req.body.password,5)
    .then(function(password) {
        return connection.query("INSERT INTO Users (Username, Password, CanSolve, CanReview) VALUES (?,?,?,?)",[
            req.body.username, password, !!req.body.canSolve, !!req.body.canReview
        ])
    })
    .then(function(results,fields) {
        resp.sendStatus(200)
    },function(e) {
        resp.sendStatus(403)
    })
}

function addProblem(req,resp) {
    if (!req.body || typeof(req.session.userid) != 'number') {
        resp.sendStatus(403)
        return
    }
    checkAuthorization(req, resp, 'canSolve', function() {
        connection.query('INSERT INTO Solutions (ProblemText, SolutionText, SolutionScore) VALUES ("","",1)')
        .then(function(results, fields) {
            resp.json(results.insertId)
        })
    })
}

function checkAuthorization(req, resp, permission, callback) {
    //Query escaping not working properly
    connection.query("SELECT UserID FROM Users WHERE UserID = " + req.session.userid + " AND " + permission + " = TRUE LIMIT 1")
    .then(function(results,fields) {
        if (results[0]) {
            return callback()
        } else {
            resp.sendStatus(403)
            return new Error()
        }
    })
}

function updateSolution(field, permission) {
    return function(req, resp) {
        if (!req.body || !req.body[field] || typeof(req.body.solutionid) != 'number' || typeof(req.session.userid) != 'number') {
            resp.sendStatus(403)
            return
        }
        checkAuthorization(req, resp, permission, function() {
            return connection.query('UPDATE Solutions SET ' + field + '=? WHERE SolutionID = ?',[req.body[field] + "", req.body.solutionid])
            .then(function(results, fields) {
                if (results.affectedRows > 0) {
                    resp.sendStatus(200)
                } else {
                    resp.sendStatus(404)
                }
            },function(e){
                resp.sendStatus(404)
            })
        })
    }
}

function getData(req, resp) {
    if (typeof(req.session.userid) != 'number') {
        resp.sendStatus(403)
        return
    }
    checkAuthorization(req, resp, 'TRUE', function (e) {
        var rows
        connection.query('SELECT * FROM Solutions')
        .then(function(results, fields) {
            rows = results.map(function(row) {
                return {
                    'solutionid' : row.SolutionID,
                    'problemText' : row.ProblemText,
                    'solutionText' : row.SolutionText,
                    'solutionScore' : row.SolutionScore
                }
            })
            return connection.query('SELECT canSolve, canReview FROM Users WHERE UserID = ? LIMIT 1',[req.session.userid]) 
        })
        .then(function(results, fields) {
            if (results.length > 0) {
                resp.json({
                    canSolve : results[0].canSolve,
                    canReview : results[0].canReview,
                    rows : rows
                })
            } else {
                resp.sendStatus(404)
            }
        })
        .catch(function(e) {
            resp.sendStatus(404)
        })
    })
}

function loggedIn(req) {
    return typeof(req.session.userid) != 'undefined'
}

exports.init = function(app,callback) {
    if (typeof(process.env.DATABASE_URL) == 'undefined') {
        console.log("No DATABASE_URL found")
        process.exit()
    }
    mysql.createConnection(process.env.DATABASE_URL)
    .then(function(conn) {
        connection = conn;
        return connection.query("CREATE TABLE IF NOT EXISTS Users (UserID BIGINT NOT NULL AUTO_INCREMENT, PRIMARY KEY (UserID),\
Username VARCHAR(32), UNIQUE INDEX (Username), Password TEXT, CanSolve BOOLEAN, CanReview BOOLEAN)")
    },function(e){
        console.log("Database error:" + process.env.DATABASE_URL)
        process.exit()
    })
    .then(function(results, fields) {
        return connection.query("CREATE TABLE IF NOT EXISTS Solutions (SolutionID BIGINT NOT NULL AUTO_INCREMENT,\
PRIMARY KEY (SolutionID), ProblemText TEXT, SolutionText TEXT, SolutionScore TINYINT(5))")
    }, function(e){
        console.log("Database error:" + process.env.DATABASE_URL)
        process.exit()
    })
    .then(function(results,fields) {
        //Routes
        sessionStore = new MySQLStore({},connection)
        app.use(session({
            key: 'session',
            secret: process.env.SESSION_SECRET,
            store: sessionStore,
            resave: false,
            saveUninitialized: true
        }))
        app.post('/login', login)
        app.get('/logout', logout)
        app.post('/createUser', createUser)
        app.get('/addProblem', addProblem)
        app.post('/update_solutionText', updateSolution('solutionText','canSolve'))
        app.post('/update_problemText',updateSolution('problemText','canSolve'))
        app.post('/update_solutionScore',updateSolution('solutionScore','canReview'))
        app.get('/getData',getData)
        return callback(connection)
    }, function(e){
        console.log("Database error:" + process.env.DATABASE_URL)
        process.exit()
    });
}