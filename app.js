// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const client = require('./lib/client');
// Initiate database connection
client.connect();

// Application Setup
const app = express();
const PORT = process.env.PORT;
app.use(morgan('dev')); // http logging
app.use(cors()); // enable CORS request
app.use(express.static('public')); // server files from /public folder
app.use(express.json()); // enable reading incoming json data
app.use(express.urlencoded({ extended: true }));

// API Routes
const createAuthRoutes = require('./lib/auth/create-auth-routes');
const authRoutes = createAuthRoutes({
    selectUser(email) {
        return client.query(`
            SELECT id, email, hash 
            FROM users
            WHERE email = $1;
        `,
        [email]
        ).then(result => result.rows[0]);
    },
    insertUser(user, hash) {
        return client.query(`
            INSERT into users (email, hash)
            VALUES ($1, $2)
            RETURNING id, email;
        `,
        [user.email, hash]
        ).then(result => result.rows[0]);
    }
});

// before ensure auth, but after other middleware:
app.use('/api/auth', authRoutes);

// for every route, on every request, make sure there is a token
const ensureAuth = require('./lib/auth/ensure-auth');

app.use('/api', ensureAuth);

// *** TODOS ***
app.get('/api/todos', async(req, res) => {

    try {
        const result = await client.query(`
            SELECT * FROM todos
            WHERE user_id = $1
            ORDER BY id ASC;
        `, [req.userId]);

        res.json(result.rows);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }

});

app.post('/api/todos', async(req, res) => {
    const task = req.body.task;
    try {
        const result = await client.query(`
            INSERT INTO todos
            (task, complete, user_id)
            VALUES ($1, false, $2)
            RETURNING *;
        `, [task, req.userId]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.put('/api/todos/:id', async(req, res) => {
    const id = req.params.id;
    const complete = req.body.complete;

    try {
        const result = await client.query(`
            UPDATE todos
            SET complete = $1
            WHERE id = $2
            AND user_id = $3;
        `, [complete, id, req.userId]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.delete('/api/todos/:id', async(req, res) => {
    const id = req.params.id;
    try {
        const result = await client.query(`
            DELETE FROM todos
            WHERE id = $1
            AND user_id = $2;
        `, [id, req.userId]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log('server running on PORT', PORT);
});