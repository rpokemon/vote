const debug = require('debug')('app');
const session = require('express-session');
const express = require('express');
const app = express();

app.use(session({
    secret: require('uuid/v4')(),
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(express.static('static'));
app.set('view engine', 'ejs');

require('./routes.js')(app);

/* other logic here */

app.listen(8080, () => {
    debug('Listening for new connections.');
});;
