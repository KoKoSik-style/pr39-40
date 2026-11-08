require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// Пул соединений
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT, // <-- Явно указываем порт MySQL (3306)
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Проверка подключения (Задание 2)
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1 AS status');
        res.json({ status: 'ok', db: 'connected' });
    } catch (err) {
        console.error("ОШИБКА БД:", err.message); // Выведет ошибку в терминал
        res.status(500).json({ error: 'Database connection failed', details: err.message });
    }
});

// Задание 3. Получение списка записей (все кружки)
app.get('/clubs', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM clubs');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch clubs' });
    }
});

// Задание 4. Получение записи по ID
app.get('/clubs/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM clubs WHERE id = ?', [id]);
        if (!rows.length) {
            return res.status(404).json({ error: 'Club not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch club' });
    }
});

// Задание 5. Вывод записей из связанной таблицы
app.get('/clubs/:id/members', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }
    try {
        const query = `
            SELECT cm.id, cm.student_id, cm.role, c.club_name 
            FROM club_members cm
            JOIN clubs c ON cm.club_id = c.id
            WHERE c.id = ?
        `;
        const [rows] = await pool.query(query, [id]);
        
        if (!rows.length) {
            return res.status(404).json({ error: 'No members found for this club' });
        }
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});