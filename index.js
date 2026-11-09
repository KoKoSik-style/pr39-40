require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// ВАЖНО: Добавляем middleware для парсинга JSON в теле запроса (нужно для POST и PUT)
app.use(express.json());

// Пул соединений
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
app.get('/health', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 AS status');
        res.json({ status: 'ok', db: 'connected' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database connection failed' });
    }
});
// --- ЗАДАНИЕ 1. READ + Фильтрация ---

// Получение списка кружков (с фильтрацией по названию, если передан параметр ?name=...)
app.get('/clubs', async (req, res) => {
    try {
        const { name } = req.query;
        let query = 'SELECT * FROM clubs';
        let params = [];

        // Если есть параметр name, добавляем фильтрацию
        if (name) {
            query += ' WHERE club_name LIKE ?';
            params.push(`%${name}%`);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch clubs' });
    }
});

// Получение кружка по ID
app.get('/clubs/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
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

// Вывод участников кружка (из ПР 38)
app.get('/clubs/:id/members', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
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

// --- ЗАДАНИЕ 2. CREATE (POST) ---

app.post('/clubs', async (req, res) => {
    const { club_name, description } = req.body;

    // Валидация
    if (!club_name || typeof club_name !== 'string' || club_name.trim().length === 0) {
        return res.status(400).json({ error: 'club_name is required and must be a non-empty string' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO clubs (club_name, description) VALUES (?, ?)',
            [club_name.trim(), description || '']
        );
        
        // Получаем созданную запись, чтобы вернуть её клиенту
        const [newClub] = await pool.query('SELECT * FROM clubs WHERE id = ?', [result.insertId]);
        res.status(201).json(newClub[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create club' });
    }
});

// --- ЗАДАНИЕ 3. UPDATE (PUT) ---

app.put('/clubs/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { club_name, description } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid ID' });
    }
    if (!club_name || typeof club_name !== 'string') {
        return res.status(400).json({ error: 'club_name is required' });
    }

    try {
        // Проверяем, существует ли запись
        const [found] = await pool.query('SELECT id FROM clubs WHERE id = ?', [id]);
        if (!found.length) {
            return res.status(404).json({ error: 'Club not found' });
        }

        // Обновляем
        await pool.query(
            'UPDATE clubs SET club_name = ?, description = ? WHERE id = ?',
            [club_name.trim(), description || '', id]
        );

        // Возвращаем обновленную запись
        const [updated] = await pool.query('SELECT * FROM clubs WHERE id = ?', [id]);
        res.json(updated[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update club' });
    }
});

// --- ЗАДАНИЕ 4. DELETE ---

app.delete('/clubs/:id', async (req, res) => {
    const id = Number(req.params.id);
    
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    try {
        const [result] = await pool.query('DELETE FROM clubs WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Club not found' });
        }
        
        res.status(204).send(); // 204 No Content - успешное удаление
    } catch (err) {
        console.error(err);
        // Если удаляемый кружок связан с участниками, и нет ON DELETE CASCADE, будет ошибка 500
        res.status(500).json({ error: 'Failed to delete club' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});