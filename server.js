const express = require('express');
const path = require('path');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5500;

// MySQL Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'your_mysql_password',
    database: 'todo_app'
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Register User
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide a username and password.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const query = 'INSERT INTO users (username, password) VALUES (?, ?)';

    db.query(query, [username, hashedPassword], (err, result) => {
        if (err) {
            return res.status(400).json({ message: 'Username already exists.' });
        }
        res.status(201).json({ message: 'User registered successfully.' });
    });
});

// Login User
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide a username and password.' });
    }

    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const user = results[0];
        const isMatch = bcrypt.compareSync(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    });
});

// Middleware to Verify Token
function auth(req, res, next) {
    const token = req.header('Authorization');
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.id;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid.' });
    }
}

// Create Task
app.post('/api/tasks', auth, (req, res) => {
    const { text, priority } = req.body;

    if (!text || !priority) {
        return res.status(400).json({ message: 'Please provide task text and priority.' });
    }

    const query = 'INSERT INTO tasks (user_id, text, priority) VALUES (?, ?, ?)';
    db.query(query, [req.user, text, priority], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error creating task.' });
        }
        res.status(201).json({ message: 'Task created successfully.' });
    });
});

// Get Tasks for User
app.get('/api/tasks', auth, (req, res) => {
    const query = 'SELECT * FROM tasks WHERE user_id = ?';
    db.query(query, [req.user], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error retrieving tasks.' });
        }
        res.json(results);
    });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
