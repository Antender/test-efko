var CreateUserDialog = {
    username : "",
    password : "",
    canSolve : false,
    canReview : false,
    message : false,
    disabled : undefined,
    view : function(vnode) {
        return m('div',[
             m('label','Имя пользователя'),
             m('input[type=text]', {onchange : m.withAttr('value', function(v) { vnode.state.username = v }), value : this.username}),
             m('label','Пароль'),
             m('input[type=password]', {onchange : m.withAttr('value', function(v) { vnode.state.password = v}), value : this.password}),
             m('label','Может создавать и редактировать проблемы и решения'),
             m('input[type=checkbox]', {onchange : m.withAttr('checked', function(v) { vnode.state.canSolve = !!v }), checked : this.canSolve ? true : undefined}),
             m('label','Может оценивать решения'),
             m('input[type=checkbox]', {onchange : m.withAttr('checked', function(v) { vnode.state.canReview = !!v}), checked : this.canReview ? true : undefined}),
             m('button[type=button]', {onclick : this.submit.bind(this), disabled : this.disabled}, 'Создать пользователя'),
             m('div',this.message)
        ])
    },
    submit : function(e) {
        var self = this
        self.disabled = true
        m.request({
            method: "POST",
            url: "/createUser",
            data: { 
                "username" : self.username,
                "password" : self.password,
                "canReview" : self.canReview,
                "canSolve" : self.canSolve
            },
            deserialize: function(value) {return value}
        })
        .then(function(res) {
            self.message = 'Пользователь создан'
            self.disabled = false
        }, function(e) {
            self.message = 'Не могу создать пользователя'
            self.disabled = false
        })
    }
}

var LoginDialog = {
    username : "",
    password : "",
    message : "",
    disabled : undefined,
    view : function(vnode) {
        return m('div',[
             m('label','Имя пользователя'),
             m('input[type=text]', {onchange : m.withAttr('value', function (v) { vnode.state.username = v }), value : this.username}),
             m('label','Пароль'),
             m('input[type=password]', {onchange : m.withAttr('value', function (v) { vnode.state.password = v }), value : this.password}),
             m('button[type=button]', {onclick : this.submit.bind(this), disabled : this.disabled}, 'Войти'),
             m('div', this.message)
        ])
    },
    submit : function(vnode) {
        var self = this
        self.disabled = true
        m.request({
            method : "POST",
            url : "/login",
            data : {
                username : self.username,
                password : self.password
            },
            deserialize: function(value) {return value}
        }) 
        .then(function(data){
            self.disabled = false
            model.getData()
        }, function(e) {
            self.disabled = false
            self.message = 'Не могу зайти с такими именем пользователя и паролем'
        })
    }
}

var Table = {
    view : function(vnode) {
        var id = 0
        return m('table',
            m('tr',[
                m('th','Проблема'),
                m('th','Решение'),
                m('th','Оценка')
            ]),
            model.table.map(function(row){
                var v = m(TableRow, {rowid : id})
                id++
                return v
            }) 
        )
    }
}

var TableRow = {
    view : function(vnode) {
        vnode.state.rowid = vnode.attrs.rowid
        vnode.state.disabled = {
            problemText : false,
            solutionText : false,
            solutionScore : false
        }
        return m('tr', { key : vnode.attrs.rowid} ,[
            m('td',m('input', { 
                onchange : m.withAttr('value', this.update.bind(this,'problemText')), 
                disabled : !model.canSolve || this.disabled.problemText, 
                value : model.table[this.rowid].problemText
            })),
            m('td',m('input', { 
                onchange : m.withAttr('value', this.update.bind(this,'solutionText')), 
                disabled : !model.canSolve ||this.disabled.solutionText, 
                value : model.table[this.rowid].solutionText
            })),
            m('td',m('input', { 
                onchange : m.withAttr('value', this.update.bind(this,'solutionScore')), 
                disabled : !model.canReview ||this.disabled.solutionScore, 
                value : model.table[this.rowid].solutionScore
            })),
        ])
    },
    update : function(field,v) {
        var self = this
        self.disabled[field] = true
        var ov = model.table[self.rowid][field]
        model.table[self.rowid][field] = v
        var data = {
            solutionid : model.table[self.rowid].solutionid,
        }
        data[field] = v
        m.request({
            method : "POST",
            url : "/update_" + field,
            data : data,
            deserialize: function(value) {return value}
        })
        .then(function(res) {
            self.disabled[field]= false
        }, function (e) {
            self.disabled[field] = false
            model.table[self.rowid][field] = ov
        })
    }
}

var model = {
    getData : function() {
        m.request('/getData')
        .then(function(res) {
            model.page = 1
            model.table = res.rows
            model.canSolve = res.canSolve
            model.canReview = res.canReview
        }, function (e) {
            model.page = 0
        })
    },
    logout : function(v) {
        m.request({
            url : '/logout',
            deserialize: function(value) {return value}
        },)
        .then(function(e) {
            model.table = []
            model.page = 0
        })
    },
    table : [],
    canSolve : false,
    canReview : false,
    page : 0
}

var Page = {
    view : function(vnode) {
        switch (model.page) {
            case 0:
                return m('div',[
                    m(LoginDialog),
                    m(CreateUserDialog)
                ])
            case 1:
                return m('div',[
                    m('button[type=button]', { onclick : model.logout }, 'Выйти'),
                    m(Table)
                ])
        }
    }
}

model.getData()
m.mount(document.body,Page)