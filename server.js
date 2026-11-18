require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
}));

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// проврека подключения базы данных
db.connect(err => {
  if (err) return console.error('MySQL:', err.message);
  console.log('MySQL подключён');
});

// выгрузка треков на html
app.get('/tracks', (req, res) => {
  db.query('SELECT * FROM tracks ORDER BY id', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// регистрация
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ error: 'Логин и пароль (мин. 6 символов) обязательны' });
  }

  db.query('SELECT id FROM users WHERE username = ?', [username], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    if (rows.length > 0) {
      return res.status(409).json({ error: 'Пользователь уже существует' });
    }

    try {
      const hash = await bcrypt.hash(password, 10);
      db.query(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username, hash],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ id: result.insertId, username });
        }
      );
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) return res.status(401).json({ error: 'Неверный логин или пароль' });

    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный логин или пароль' });

    req.session.user = { id: rows[0].id, username: rows[0].username };
    res.json({ id: rows[0].id, username: rows[0].username });
  });
});

// выход
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// проверка авторизован ли я
app.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Не авторизован' });
  res.json(req.session.user);
});

// список отзывов
app.post('/reviews/list', (req, res) => {
  const trackId = req.body.track_id;
  if (!trackId) return res.status(400).json({ error: 'track_id обязателен' });

  db.query(
    `SELECT r.id, r.text, r.rating, r.created_at, u.username FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.track_id = ? ORDER BY r.created_at DESC`,
    [trackId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// добавить отзыв только авторизованному пользователю
app.post('/reviews/add', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Только для авторизованных' });
  }
  const { track_id, text, rating } = req.body;
  if (!track_id || !text || !rating) {
    return res.status(400).json({ error: 'track_id, text и rating обязательны' });
  }
  db.query(
    'INSERT INTO reviews (track_id, user_id, text, rating) VALUES (?, ?, ?, ?)',
    [track_id, req.session.user.id, text, rating],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: result.insertId });
    }
  );
});

// старт сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));