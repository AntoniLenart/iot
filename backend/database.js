import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'crypto';

const router = express.Router();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: { rejectUnauthorized: false }
});

function ensureJson(req, res, next) {
    if (!req.is('application/json')) {
        return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    next();
}

// Utility functions for password hashing
const hashPassword = (password) => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(salt + ':' + derivedKey.toString('hex'));
    });
  });
};

const verifyPassword = (password, hash) => {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString('hex'));
    });
  });
};

// ---- USERS ----
router.get('/users/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.users ORDER BY user_id ASC');
        res.status(200).json({ users: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/users/create', ensureJson, async (req, res) => {
    let username_tmp = ""

    const { username, first_name, last_name, email, phone, user_type = 'employee', department, employee_number, password } = req.body;
    if (!first_name || !last_name || !password) {
        return res.status(400).json({ error: 'first_name, last_name, and password are required' });
    }

    // REGEX for first/last name, phone number and email verification
    const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{3,6}$/;
    const nameRegex = /^[A-Za-zÀ-ÿ\-]{2,100}$/;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,100}$/;

    if (!nameRegex.test(first_name)) {
        return res.status(400).json({ error: 'Invalid first name format' });
    }
    if (!nameRegex.test(last_name)) {
        return res.status(400).json({ error: 'Invalid last name format' });
    }
    if (email && !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    if (phone && !phoneRegex.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
    }
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ 
        error: 'Password must be at least 8 characters long and include: uppercase, lowercase, number, special character'
        });
    }

    if (!username || username.trim() === "") {
        username_tmp = `${first_name}_${last_name}`;
    }

    try {
        const hashedPassword = await hashPassword(password);
        const insertQuery = `
      INSERT INTO access_mgmt.users (username, first_name, last_name, email, phone, password_hash, user_type, department, employee_number)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING user_id, username, first_name, last_name, email, phone, user_type, department, employee_number, created_at;
    `;
        const result = await pool.query(insertQuery, [
            username || username_tmp, first_name, last_name, email || null, phone || null, hashedPassword,
            user_type, department || null, employee_number || null
        ]);
        res.status(201).json({ user: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: err });
    }
});

router.post('/users/remove', ensureJson, async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    try {
        const result = await pool.query('DELETE FROM access_mgmt.users WHERE user_id = $1 RETURNING user_id', [user_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'user not found' });
        res.status(200).json({ deleted: result.rows[0].user_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/users/update', ensureJson, async (req, res) => {
    const { user_id, password, email, phone, ...fields } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{3,6}$/;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,100}$/;

    if (email && !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    if (phone && !phoneRegex.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
    }
    if (!passwordRegex.test(password) && password) {
        return res.status(400).json({ 
        error: 'Password must be at least 8 characters long and include: uppercase, lowercase, number, special character'
        });
    }

    try {
        if (password) fields.password_hash = await hashPassword(password);
        fields.email = email;
        fields.phone = phone;
        const allowed = ['username','first_name','last_name','email','phone','user_type','department','employee_number','is_active','metadata','password_hash'];
        const sets = [];
        const values = [];
        let idx = 1;
        for (const key of Object.keys(fields)) {
            if (!allowed.includes(key)) continue;
            sets.push(`${key} = $${idx}`);
            values.push(fields[key]);
            idx++;
        }

        if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });

        sets.push(`updated_at = now()`);

        console.log(sets)

        const sql = `UPDATE access_mgmt.users SET ${sets.join(', ')} WHERE user_id = $${idx} RETURNING *`;
        values.push(user_id);

        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'user not found' });
        res.status(200).json({ user: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/users/get', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.users WHERE user_id = $1', [user_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'user not found' });
        res.status(200).json({ user: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/users/getByName', async (req, res) => {
    const { first_name, last_name } = req.query;
    if (!first_name || !last_name) return res.status(400).json({ error: 'first and last name are required' });
    try {
        const result = await pool.query('SELECT user_id FROM access_mgmt.users WHERE first_name = $1 AND last_name = $2', [first_name, last_name]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'user not found' });
        res.status(200).json({ user: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- DEVICES ----
router.get('/devices/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.devices ORDER BY device_id ASC');
        res.status(200).json({ devices: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/devices/create', ensureJson, async (req, res) => {
    const { name, device_type, model, serial_no, location, room_id, ip_address, mac_address, firmware_version, metadata } = req.body;
    if (!name || !device_type) return res.status(400).json({ error: 'name and device_type are required' });
    try {
        const insert = `INSERT INTO access_mgmt.devices (name, device_type, model, serial_no, location, room_id, ip_address, mac_address, firmware_version, metadata)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`;
        const values = [name, device_type, model || null, serial_no || null, location || null, room_id || null, ip_address || null, mac_address || null, firmware_version || null, metadata || {}];
        const result = await pool.query(insert, values);
        res.status(201).json({ device: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/devices/remove', ensureJson, async (req, res) => {
    const { device_id } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.devices WHERE device_id = $1 RETURNING device_id', [device_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'device not found' });
        res.status(200).json({ deleted: result.rows[0].device_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/devices/update', ensureJson, async (req, res) => {
    const { device_id, ...fields } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });
    const allowed = ['name','device_type','model','serial_no','location','room_id','ip_address','mac_address','firmware_version','is_active','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    sets.push('updated_at = now()');
    const sql = `UPDATE access_mgmt.devices SET ${sets.join(', ')} WHERE device_id = $${idx} RETURNING *`;
    values.push(device_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'device not found' });
        res.status(200).json({ device: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/devices/get', async (req, res) => {
    const { device_id } = req.query;
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.devices WHERE device_id = $1', [device_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'device not found' });
        res.status(200).json({ device: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- CREDENTIALS ----
router.get('/credentials/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.credentials ORDER BY credential_id ASC');
        res.status(200).json({ credentials: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/credentials/create', ensureJson, async (req, res) => {
    const { user_id, credential_type, identifier = null, token_value = null, credential_data = null, issued_by, expires_at, is_active, metadata } = req.body;
    if (!credential_type) return res.status(400).json({ error: 'credential_type is required' });
    try {
        const insert = `INSERT INTO access_mgmt.credentials (user_id, credential_type, identifier, issued_by, issued_at, expires_at, is_active, metadata, token_value, credential_data)
                        VALUES ($1,$2,$3,$4,COALESCE($5, now()),$6,$7,$8,$9,$10) RETURNING *`;
        const values = [user_id || null, credential_type, identifier, issued_by || null, null, expires_at || null, is_active !== undefined ? is_active : true, metadata || {}, token_value || null, credential_data || null];
        const result = await pool.query(insert, values);
        res.status(201).json({ credential: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/credentials/remove', ensureJson, async (req, res) => {
    const { credential_id } = req.body;
    if (!credential_id) return res.status(400).json({ error: 'credential_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.credentials WHERE credential_id = $1 RETURNING credential_id', [credential_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'credential not found' });
        res.status(200).json({ deleted: result.rows[0].credential_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/credentials/update', ensureJson, async (req, res) => {
    const { credential_id, ...fields } = req.body;
    if (!credential_id) return res.status(400).json({ error: 'credential_id is required' });
    const allowed = ['user_id','credential_type','identifier','issued_by','expires_at','is_active','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    sets.push('issued_at = COALESCE(issued_at, now())');
    const sql = `UPDATE access_mgmt.credentials SET ${sets.join(', ')} WHERE credential_id = $${idx} RETURNING *`;
    values.push(credential_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'credential not found' });
        res.status(200).json({ credential: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/credentials/get', async (req, res) => {
    const { credential_id } = req.query;
    if (!credential_id) return res.status(400).json({ error: 'credential_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.credentials WHERE credential_id = $1', [credential_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'credential not found' });
        res.status(200).json({ credential: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/credentials/getByUserId', async (req, res) => {
    const { user_id, type } = req.query;
    if (!user_id || !type) return res.status(400).json({ error: 'user_id and type is required' });
    try {
        const result = await pool.query('SELECT identifier, credential_id FROM access_mgmt.credentials WHERE user_id = $1 AND credential_type = $2', [user_id, type]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'credential not found' });
        res.status(200).json({ credential: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- QR CODES ----
router.get('/qr/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.qr_codes ORDER BY qr_id ASC');
        res.status(200).json({ qr_codes: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

export async function createQR({ code, credential_id, valid_from, valid_until, usage_limit, recipient_info, metadata, issued_by }) {
    if (!valid_until) throw new Error('valid_until is required');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let credId = credential_id || null;
        const tokenVal = code || null;
        if (!credId) {
            // create a placeholder credential tied to no user (external token)
            const credRes = await client.query(
                `INSERT INTO access_mgmt.credentials (user_id, credential_type, identifier, issued_by, issued_at, expires_at, is_active, token_value)
                 VALUES ($1,$2,$3,$4,now(),$5,$6,$7) RETURNING credential_id`,
                [null, 'qr_code', null, issued_by || null, valid_until, true, tokenVal]
            );
            credId = credRes.rows[0].credential_id;
        } else {
            // update existing credential token_value and expires_at
            await client.query(
                `UPDATE access_mgmt.credentials SET token_value = $1, expires_at = $2 WHERE credential_id = $3`,
                [tokenVal, valid_until, credId]
            );
        }

        const insert = `INSERT INTO access_mgmt.qr_codes (code, credential_id, created_at, valid_from, valid_until, usage_limit, usage_count, is_active, recipient_info, metadata)
                        VALUES (COALESCE($1, gen_random_uuid()::text), $2, now(), COALESCE($3, now()), $4, $5, 0, true, $6, $7) RETURNING *`;
        const values = [code || null, credId, valid_from || null, valid_until, usage_limit || 1, recipient_info || null, metadata];
        const result = await client.query(insert, values);

        await client.query('COMMIT');
        return { qr: result.rows[0], credential_id: credId };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

router.post('/qr/create', ensureJson, async (req, res) => {
    try {
        const result = await createQR(req.body);
        res.status(201).json(result);
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/qr/remove', ensureJson, async (req, res) => {
    const { qr_id } = req.body;
    if (!qr_id) return res.status(400).json({ error: 'qr_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.qr_codes WHERE qr_id = $1 RETURNING qr_id', [qr_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'qr not found' });
        res.status(200).json({ deleted: result.rows[0].qr_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/qr/update', ensureJson, async (req, res) => {
    const { qr_id, ...fields } = req.body;
    if (!qr_id) return res.status(400).json({ error: 'qr_id is required' });
    const allowed = ['code','credential_id','valid_from','valid_until','usage_limit','usage_count','is_active','recipient_info','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.qr_codes SET ${sets.join(', ')} WHERE qr_id = $${idx} RETURNING *`;
    values.push(qr_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'qr not found' });
        res.status(200).json({ qr: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/qr/get', async (req, res) => {
    const { qr_id } = req.query;
    if (!qr_id) return res.status(400).json({ error: 'qr_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.qr_codes WHERE qr_id = $1', [qr_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'qr not found' });
        res.status(200).json({ qr: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- RESERVATIONS ----
router.get('/reservations/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.reservations ORDER BY reservation_id ASC');
        res.status(200).json({ reservations: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/reservations/create', ensureJson, async (req, res) => {
    const { desk_id, user_id, start_at, end_at, created_by, status, metadata } = req.body;
    if (!desk_id || !start_at || !end_at) return res.status(400).json({ error: 'desk_id, start_at and end_at are required' });
    try {
        const insert = `INSERT INTO access_mgmt.reservations (desk_id, user_id, start_at, end_at, created_at, created_by, status, metadata)
                        VALUES ($1,$2,$3,$4,now(),$5,$6,$7) RETURNING *`;
        const values = [desk_id, user_id || null, start_at, end_at, created_by || null, status || 'confirmed', metadata || {}];
        const result = await pool.query(insert, values);
        res.status(201).json({ reservation: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/reservations/remove', ensureJson, async (req, res) => {
    const { reservation_id } = req.body;
    if (!reservation_id) return res.status(400).json({ error: 'reservation_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.reservations WHERE reservation_id = $1 RETURNING reservation_id', [reservation_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'reservation not found' });
        res.status(200).json({ deleted: result.rows[0].reservation_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/reservations/update', ensureJson, async (req, res) => {
    const { reservation_id, ...fields } = req.body;
    if (!reservation_id) return res.status(400).json({ error: 'reservation_id is required' });
    const allowed = ['desk_id','user_id','start_at','end_at','created_by','status','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    sets.push('');
    const sql = `UPDATE access_mgmt.reservations SET ${sets.join(', ')} WHERE reservation_id = $${idx} RETURNING *`;
    values.push(reservation_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'reservation not found' });
        res.status(200).json({ reservation: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/reservations/get', async (req, res) => {
    const { reservation_id } = req.query;
    if (!reservation_id) return res.status(400).json({ error: 'reservation_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.reservations WHERE reservation_id = $1', [reservation_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'reservation not found' });
        res.status(200).json({ reservation: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- ROOMS ----
router.get('/rooms/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.rooms ORDER BY room_id ASC');
        res.status(200).json({ rooms: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/rooms/get', async (req, res) => {
    const { room_id } = req.query;
    if (!room_id) return res.status(400).json({ error: 'room_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.rooms WHERE room_id = $1', [room_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'room not found' });
        res.status(200).json({ room: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/rooms/create', ensureJson, async (req, res) => {
    const { name, floor, capacity, description, metadata } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
        const insert = `INSERT INTO access_mgmt.rooms (name, floor, capacity, description, metadata) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
        const values = [name, floor || null, capacity || null, description || null, metadata || {}];
        const result = await pool.query(insert, values);
        res.status(201).json({ room: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/rooms/remove', ensureJson, async (req, res) => {
    const { room_id } = req.body;
    if (!room_id) return res.status(400).json({ error: 'room_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.rooms WHERE room_id = $1 RETURNING room_id', [room_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'room not found' });
        res.status(200).json({ deleted: result.rows[0].room_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/rooms/update', ensureJson, async (req, res) => {
    const { room_id, ...fields } = req.body;
    if (!room_id) return res.status(400).json({ error: 'room_id is required' });
    const allowed = ['name','floor','capacity','description','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.rooms SET ${sets.join(', ')} WHERE room_id = $${idx} RETURNING *`;
    values.push(room_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'room not found' });
        res.status(200).json({ room: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- DOORS ----
router.get('/doors/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.doors ORDER BY door_id ASC');
        res.status(200).json({ doors: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/doors/get', async (req, res) => {
    const { door_id } = req.query;
    if (!door_id) return res.status(400).json({ error: 'door_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.doors WHERE door_id = $1', [door_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'door not found' });
        res.status(200).json({ door: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/doors/create', ensureJson, async (req, res) => {
    const { room_id, name, hardware_id, door_type, is_locked } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
        const insert = `INSERT INTO access_mgmt.doors (room_id, name, hardware_id, door_type, is_locked) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
        const values = [room_id || null, name, hardware_id || null, door_type || null, is_locked !== undefined ? is_locked : true];
        const result = await pool.query(insert, values);
        res.status(201).json({ door: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/doors/remove', ensureJson, async (req, res) => {
    const { door_id } = req.body;
    if (!door_id) return res.status(400).json({ error: 'door_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.doors WHERE door_id = $1 RETURNING door_id', [door_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'door not found' });
        res.status(200).json({ deleted: result.rows[0].door_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/doors/update', ensureJson, async (req, res) => {
    const { door_id, ...fields } = req.body;
    if (!door_id) return res.status(400).json({ error: 'door_id is required' });
    const allowed = ['room_id','name','hardware_id','door_type','is_locked'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.doors SET ${sets.join(', ')} WHERE door_id = $${idx} RETURNING *`;
    values.push(door_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'door not found' });
        res.status(200).json({ door: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- DESKS ----
router.get('/desks/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.desks ORDER BY desk_id ASC');
        res.status(200).json({ desks: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/desks/get', async (req, res) => {
    const { desk_id } = req.query;
    if (!desk_id) return res.status(400).json({ error: 'desk_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.desks WHERE desk_id = $1', [desk_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'desk not found' });
        res.status(200).json({ desk: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/desks/create', ensureJson, async (req, res) => {
    const { room_id, code, description, is_available, metadata } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required' });
    try {
        const insert = `INSERT INTO access_mgmt.desks (room_id, code, description, is_available, metadata) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
        const values = [room_id || null, code, description || null, is_available !== undefined ? is_available : true, metadata || {}];
        const result = await pool.query(insert, values);
        res.status(201).json({ desk: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/desks/remove', ensureJson, async (req, res) => {
    const { desk_id } = req.body;
    if (!desk_id) return res.status(400).json({ error: 'desk_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.desks WHERE desk_id = $1 RETURNING desk_id', [desk_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'desk not found' });
        res.status(200).json({ deleted: result.rows[0].desk_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/desks/update', ensureJson, async (req, res) => {
    const { desk_id, ...fields } = req.body;
    if (!desk_id) return res.status(400).json({ error: 'desk_id is required' });
    const allowed = ['room_id','code','description','is_available','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.desks SET ${sets.join(', ')} WHERE desk_id = $${idx} RETURNING *`;
    values.push(desk_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'desk not found' });
        res.status(200).json({ desk: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- USER_GROUPS ----
router.get('/user_groups/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.user_groups ORDER BY group_id ASC');
        res.status(200).json({ user_groups: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/user_groups/get', async (req, res) => {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.user_groups WHERE group_id = $1', [group_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'user_group not found' });
        res.status(200).json({ user_group: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/user_groups/create', ensureJson, async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
        const insert = `INSERT INTO access_mgmt.user_groups (name, description) VALUES ($1,$2) RETURNING *`;
        const values = [name, description || null];
        const result = await pool.query(insert, values);
        res.status(201).json({ user_group: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/user_groups/remove', ensureJson, async (req, res) => {
    const { group_id } = req.body;
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.user_groups WHERE group_id = $1 RETURNING group_id', [group_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'user_group not found' });
        res.status(200).json({ deleted: result.rows[0].group_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/user_groups/update', ensureJson, async (req, res) => {
    const { group_id, ...fields } = req.body;
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });
    const allowed = ['name','description'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.user_groups SET ${sets.join(', ')} WHERE group_id = $${idx} RETURNING *`;
    values.push(group_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'user_group not found' });
        res.status(200).json({ user_group: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- USER_ACCESS_GROUPS ----
router.get('/user_access_groups/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.user_access_groups ORDER BY user_id, group_id ASC');
        res.status(200).json({ user_access_groups: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/user_access_groups/create', ensureJson, async (req, res) => {
    const { user_id, group_id, assigned_by } = req.body;
    if (!user_id || !group_id) return res.status(400).json({ error: 'user_id and group_id are required' });
    try {
        const insert = `INSERT INTO access_mgmt.user_access_groups (user_id, group_id, assigned_by) VALUES ($1,$2,$3) RETURNING *`;
        const values = [user_id, group_id, assigned_by || null];
        const result = await pool.query(insert, values);
        res.status(201).json({ user_access_group: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/user_access_groups/remove', ensureJson, async (req, res) => {
    const { user_id, group_id } = req.body;
    if (!user_id || !group_id) return res.status(400).json({ error: 'user_id and group_id are required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.user_access_groups WHERE user_id = $1 AND group_id = $2 RETURNING user_id, group_id', [user_id, group_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'user_access_group not found' });
        res.status(200).json({ deleted: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/user_access_groups/get', async (req, res) => {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.user_access_groups WHERE group_id = $1', [group_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'user_group not found' });
        res.status(200).json({ 
            users: result.rows
        });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- ACCESS_POLICIES ----
router.get('/access_policies/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.access_policies ORDER BY policy_id ASC');
        res.status(200).json({ access_policies: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/access_policies/get', async (req, res) => {
    const { policy_id } = req.query;
    if (!policy_id) return res.status(400).json({ error: 'policy_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.access_policies WHERE policy_id = $1', [policy_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'access_policy not found' });
        res.status(200).json({ access_policy: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/access_policies/create', ensureJson, async (req, res) => {
    const { name, description, action, is_active, metadata } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
        const insert = `INSERT INTO access_mgmt.access_policies (name, description, action, is_active, metadata) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
        const values = [name, description || null, action || 'allow', is_active !== undefined ? is_active : true, metadata || {}];
        const result = await pool.query(insert, values);
        res.status(201).json({ access_policy: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/access_policies/remove', ensureJson, async (req, res) => {
    const { policy_id } = req.body;
    if (!policy_id) return res.status(400).json({ error: 'policy_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.access_policies WHERE policy_id = $1 RETURNING policy_id', [policy_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'access_policy not found' });
        res.status(200).json({ deleted: result.rows[0].policy_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/access_policies/update', ensureJson, async (req, res) => {
    const { policy_id, ...fields } = req.body;
    if (!policy_id) return res.status(400).json({ error: 'policy_id is required' });
    const allowed = ['name','description','action','is_active','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    sets.push('updated_at = now()');
    const sql = `UPDATE access_mgmt.access_policies SET ${sets.join(', ')} WHERE policy_id = $${idx} RETURNING *`;
    values.push(policy_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'access_policy not found' });
        res.status(200).json({ access_policy: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- POLICY_RULES ----
router.get('/policy_rules/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.policy_rules ORDER BY policy_rule_id ASC');
        res.status(200).json({ policy_rules: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/policy_rules/get', async (req, res) => {
    const { policy_id } = req.query;
    if (!policy_id) return res.status(400).json({ error: 'policy_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.policy_rules WHERE policy_id = $1', [policy_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'policy_rule not found' });
        res.status(200).json({ 
            policy_rules: result.rows
        });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/policy_rules/getByRoomAndPolicy', async (req, res) => {
    const { room_id, policy_id } = req.query;
    if (!room_id || !policy_id) return res.status(400).json({ error: 'room_id and policy_id are required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.policy_rules WHERE room_id = $1 AND policy_id = $2', [room_id, policy_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'policy_rule not found' });
        res.status(200).json({ policy_rule: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/policy_rules/create', ensureJson, async (req, res) => {
    const { policy_id, room_id, is_active, rules, metadata } = req.body;
    if (!policy_id || !room_id) return res.status(400).json({ error: 'policy_id and room_id are required' });
    try {
        const insert = `INSERT INTO access_mgmt.policy_rules (policy_id, room_id, is_active, rules, metadata) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
        const values = [policy_id, room_id, is_active !== undefined ? is_active : true, rules || {}, metadata || {}];
        const result = await pool.query(insert, values);
        res.status(201).json({ policy_rule: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/policy_rules/remove', ensureJson, async (req, res) => {
    const { policy_rule_id } = req.body;
    if (!policy_rule_id) return res.status(400).json({ error: 'policy_rule_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.policy_rules WHERE policy_rule_id = $1 RETURNING policy_rule_id', [policy_rule_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'policy_rule not found' });
        res.status(200).json({ deleted: result.rows[0].policy_rule_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/policy_rules/update', ensureJson, async (req, res) => {
    const { policy_rule_id, ...fields } = req.body;
    if (!policy_rule_id) return res.status(400).json({ error: 'policy_rule_id is required' });
    const allowed = ['policy_id','room_id','is_active','rules','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.policy_rules SET ${sets.join(', ')} WHERE policy_rule_id = $${idx} RETURNING *`;
    values.push(policy_rule_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'policy_rule not found' });
        res.status(200).json({ policy_rule: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- GROUP_POLICIES ----
router.get('/group_policies/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.group_policies ORDER BY group_id, policy_id ASC');
        res.status(200).json({ group_policies: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/group_policies/create', ensureJson, async (req, res) => {
    const { group_id, policy_id } = req.body;
    if (!group_id || !policy_id) return res.status(400).json({ error: 'group_id and policy_id are required' });
    try {
        const insert = `INSERT INTO access_mgmt.group_policies (group_id, policy_id) VALUES ($1,$2) RETURNING *`;
        const values = [group_id, policy_id];
        const result = await pool.query(insert, values);
        res.status(201).json({ group_policy: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/group_policies/get', async (req, res) => {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.group_policies WHERE group_id = $1', [group_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'group_policy not found' });
        res.status(200).json({ group_policy: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/group_policies/remove', ensureJson, async (req, res) => {
    const { group_id, policy_id } = req.body;
    if (!group_id || !policy_id) return res.status(400).json({ error: 'group_id and policy_id are required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.group_policies WHERE group_id = $1 AND policy_id = $2 RETURNING group_id, policy_id', [group_id, policy_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'group_policy not found' });
        res.status(200).json({ deleted: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- BIOMETRIC_TEMPLATES ----
router.get('/biometric_templates/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.biometric_templates ORDER BY template_id ASC');
        res.status(200).json({ biometric_templates: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/biometric_templates/get', async (req, res) => {
    const { template_id } = req.query;
    if (!template_id) return res.status(400).json({ error: 'template_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.biometric_templates WHERE template_id = $1', [template_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'biometric_template not found' });
        res.status(200).json({ biometric_template: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/biometric_templates/create', ensureJson, async (req, res) => {
    const { user_id, credential_id, biometric_type, template, template_hash, enrolled_by, is_active, metadata } = req.body;
    if (!user_id || !biometric_type || !template || !template_hash) return res.status(400).json({ error: 'user_id, biometric_type, template, and template_hash are required' });
    try {
        const insert = `INSERT INTO access_mgmt.biometric_templates (user_id, credential_id, biometric_type, template, template_hash, enrolled_by, is_active, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
        const values = [user_id, credential_id || null, biometric_type, template, template_hash, enrolled_by || null, is_active !== undefined ? is_active : true, metadata || {}];
        const result = await pool.query(insert, values);
        res.status(201).json({ biometric_template: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/biometric_templates/remove', ensureJson, async (req, res) => {
    const { template_id } = req.body;
    if (!template_id) return res.status(400).json({ error: 'template_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.biometric_templates WHERE template_id = $1 RETURNING template_id', [template_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'biometric_template not found' });
        res.status(200).json({ deleted: result.rows[0].template_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/biometric_templates/update', ensureJson, async (req, res) => {
    const { template_id, ...fields } = req.body;
    if (!template_id) return res.status(400).json({ error: 'template_id is required' });
    const allowed = ['user_id','credential_id','biometric_type','template','template_hash','enrolled_by','is_active','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.biometric_templates SET ${sets.join(', ')} WHERE template_id = $${idx} RETURNING *`;
    values.push(template_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'biometric_template not found' });
        res.status(200).json({ biometric_template: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- RFID_CARDS ----
router.get('/rfid_cards/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.rfid_cards ORDER BY card_id ASC');
        res.status(200).json({ rfid_cards: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/rfid_cards/get', async (req, res) => {
    const { card_id } = req.query;
    if (!card_id) return res.status(400).json({ error: 'card_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.rfid_cards WHERE card_id = $1', [card_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'rfid_card not found' });
        res.status(200).json({ rfid_card: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/rfid_cards/create', ensureJson, async (req, res) => {
    const { credential_id, serial, issued_by, is_active, metadata } = req.body;
    if (!credential_id) return res.status(400).json({ error: 'credential_id is required' });
    try {
               const insert = `INSERT INTO access_mgmt.rfid_cards (credential_id, serial, issued_by, is_active, metadata) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
        const values = [credential_id, serial || null, issued_by || null, is_active !== undefined ? is_active : true, metadata || {}];
        const result = await pool.query(insert, values);
        res.status(201).json({ rfid_card: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/rfid_cards/remove', ensureJson, async (req, res) => {
    const { card_id } = req.body;
    if (!card_id) return res.status(400).json({ error: 'card_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.rfid_cards WHERE card_id = $1 RETURNING card_id', [card_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'rfid_card not found' });
        res.status(200).json({ deleted: result.rows[0].card_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/rfid_cards/update', ensureJson, async (req, res) => {
    const { card_id, ...fields } = req.body;
    if (!card_id) return res.status(400).json({ error: 'card_id is required' });
    const allowed = ['credential_id','serial','issued_by','is_active','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.rfid_cards SET ${sets.join(', ')} WHERE card_id = $${idx} RETURNING *`;
    values.push(card_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'rfid_card not found' });
        res.status(200).json({ rfid_card: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- ACCESS_LOGS ----
router.get('/access_logs/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.access_logs ORDER BY log_id ASC');
        res.status(200).json({ access_logs: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/access_logs/get', async (req, res) => {
    const { log_id } = req.query;
    if (!log_id) return res.status(400).json({ error: 'log_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.access_logs WHERE log_id = $1', [log_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'access_log not found' });
        res.status(200).json({ access_log: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/access_logs/create', ensureJson, async (req, res) => {
    const { device_id, door_id, user_id, credential_id, action, success, reason, raw_event, ip_address } = req.body;
    if (!action) return res.status(400).json({ error: 'action is required' });
    try {
        const insert = `INSERT INTO access_mgmt.access_logs (device_id, door_id, user_id, credential_id, action, success, reason, raw_event, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`;
        const values = [device_id || null, door_id || null, user_id || null, credential_id || null, action, success !== undefined ? success : true, reason || null, raw_event || {}, ip_address || null];
        const result = await pool.query(insert, values);
        res.status(201).json({ access_log: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- EVENTS ----
router.get('/events/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.events ORDER BY event_id ASC');
        res.status(200).json({ events: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/events/get', async (req, res) => {
    const { event_id } = req.query;
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.events WHERE event_id = $1', [event_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'event not found' });
        res.status(200).json({ event: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/events/create', ensureJson, async (req, res) => {
    const { event_type, severity, door_id, device_id, related_log_id, description, acknowledged_by, metadata } = req.body;
    if (!event_type) return res.status(400).json({ error: 'event_type is required' });
    try {
        const insert = `INSERT INTO access_mgmt.events (event_type, severity, door_id, device_id, related_log_id, description, acknowledged_by, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
        const values = [event_type, severity || 1, door_id || null, device_id || null, related_log_id || null, description || null, acknowledged_by || null, metadata || {}];
        const result = await pool.query(insert, values);
        res.status(201).json({ event: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/events/remove', ensureJson, async (req, res) => {
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.events WHERE event_id = $1 RETURNING event_id', [event_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'event not found' });
        res.status(200).json({ deleted: result.rows[0].event_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/events/update', ensureJson, async (req, res) => {
    const { event_id, ...fields } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });
    const allowed = ['event_type','severity','door_id','device_id','related_log_id','description','acknowledged_by','acknowledged_at','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.events SET ${sets.join(', ')} WHERE event_id = $${idx} RETURNING *`;
    values.push(event_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'event not found' });
        res.status(200).json({ event: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/emergencies/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.emergencies ORDER BY emergency_id ASC');
        res.status(200).json({ emergencies: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/emergencies/get', async (req, res) => {
    const { emergency_id } = req.query;
    if (!emergency_id) return res.status(400).json({ error: 'emergency_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.emergencies WHERE emergency_id = $1', [emergency_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'emergency not found' });
        res.status(200).json({ emergency: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/emergencies/create', ensureJson, async (req, res) => {
    const { name, description, trigger_type, actions, is_active } = req.body;
    if (!name || !trigger_type || !actions) return res.status(400).json({ error: 'name, trigger_type, and actions are required' });
    try {
        const insert = `INSERT INTO access_mgmt.emergencies (name, description, trigger_type, actions, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
        const values = [name, description || null, trigger_type, actions, is_active !== undefined ? is_active : true];
        const result = await pool.query(insert, values);
        res.status(201).json({ emergency: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/emergencies/remove', ensureJson, async (req, res) => {
    const { emergency_id } = req.body;
    if (!emergency_id) return res.status(400).json({ error: 'emergency_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.emergencies WHERE emergency_id = $1 RETURNING emergency_id', [emergency_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'emergency not found' });
        res.status(200).json({ deleted: result.rows[0].emergency_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/emergencies/update', ensureJson, async (req, res) => {
    const { emergency_id, ...fields } = req.body;
    if (!emergency_id) return res.status(400).json({ error: 'emergency_id is required' });
    const allowed = ['name','description','trigger_type','actions','is_active'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.emergencies SET ${sets.join(', ')} WHERE emergency_id = $${idx} RETURNING *`;
    values.push(emergency_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'emergency not found' });
        res.status(200).json({ emergency: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- ADMIN_AUDIT ----
router.get('/admin_audit/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.admin_audit ORDER BY audit_id ASC');
        res.status(200).json({ admin_audit: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/admin_audit/get', async (req, res) => {
    const { audit_id } = req.query;
    if (!audit_id) return res.status(400).json({ error: 'audit_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.admin_audit WHERE audit_id = $1', [audit_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'admin_audit not found' });
        res.status(200).json({ admin_audit: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/admin_audit/create', ensureJson, async (req, res) => {
    const { admin_user, action, target_type, target_id, details, ip_address } = req.body;
    if (!action) return res.status(400).json({ error: 'action is required' });
    try {
        const insert = `INSERT INTO access_mgmt.admin_audit (admin_user, action, target_type, target_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
        const values = [admin_user || null, action, target_type || null, target_id || null, details || {}, ip_address || null];
        const result = await pool.query(insert, values);
        res.status(201).json({ admin_audit: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- CREDENTIAL_POLICIES ----
router.get('/credential_policies/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.credential_policies ORDER BY credential_id, policy_id ASC');
        res.status(200).json({ credential_policies: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/credential_policies/create', ensureJson, async (req, res) => {
    const { credential_id, policy_id, assigned_by, valid_from, valid_until, is_active, metadata } = req.body;
    if (!credential_id || !policy_id) return res.status(400).json({ error: 'credential_id and policy_id are required' });
    try {
        const insert = `INSERT INTO access_mgmt.credential_policies (credential_id, policy_id, assigned_by, valid_from, valid_until, is_active, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`;
        const values = [credential_id, policy_id, assigned_by || null, valid_from || null, valid_until || null, is_active !== undefined ? is_active : true, metadata || {}];
        const result = await pool.query(insert, values);
        res.status(201).json({ credential_policy: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/credential_policies/remove', ensureJson, async (req, res) => {
    const { credential_id, policy_id } = req.body;
    if (!credential_id || !policy_id) return res.status(400).json({ error: 'credential_id and policy_id are required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.credential_policies WHERE credential_id = $1 AND policy_id = $2 RETURNING credential_id, policy_id', [credential_id, policy_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'credential_policy not found' });
        res.status(200).json({ deleted: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/credential_policies/update', ensureJson, async (req, res) => {
    const { credential_id, policy_id, ...fields } = req.body;
    if (!credential_id || !policy_id) return res.status(400).json({ error: 'credential_id and policy_id are required' });
    const allowed = ['assigned_by','valid_from','valid_until','is_active','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.credential_policies SET ${sets.join(', ')} WHERE credential_id = $${idx} AND policy_id = $${idx+1} RETURNING *`;
    values.push(credential_id, policy_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'credential_policy not found' });
        res.status(200).json({ credential_policy: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

// ---- SVG_FILES ----
router.get('/svg_files/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.svg_files ORDER BY svg_id ASC');
        res.status(200).json({ svg_files: result.rows });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/svg_files/create', ensureJson, async (req, res) => {
    const { filename, description, content, added_by, metadata } = req.body;
    if (!filename || !content) return res.status(400).json({ error: 'filename and content are required' });
    try {
        const insert = `INSERT INTO access_mgmt.svg_files (filename, description, content, added_by, metadata) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
        const values = [filename, description || null, content, added_by || null, metadata || {}];
        const result = await pool.query(insert, values);
        res.status(201).json({ svg_file: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.post('/svg_files/remove', ensureJson, async (req, res) => {
    const { svg_id } = req.body;
    if (!svg_id) return res.status(400).json({ error: 'svg_id is required' });
    try {
        const result = await pool.query('DELETE FROM access_mgmt.svg_files WHERE svg_id = $1 RETURNING svg_id', [svg_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'svg_file not found' });
        res.status(200).json({ deleted: result.rows[0].svg_id });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.patch('/svg_files/update', ensureJson, async (req, res) => {
    const { svg_id, ...fields } = req.body;
    if (!svg_id) return res.status(400).json({ error: 'svg_id is required' });
    const allowed = ['filename','description','content','added_by','is_active','metadata'];
    const sets = []; const values = []; let idx = 1;
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = $${idx}`); values.push(fields[key]); idx++;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
    const sql = `UPDATE access_mgmt.svg_files SET ${sets.join(', ')} WHERE svg_id = $${idx} RETURNING *`;
    values.push(svg_id);
    try {
        const result = await pool.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'svg_file not found' });
        res.status(200).json({ svg_file: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

router.get('/svg_files/get', async (req, res) => {
    const { svg_id } = req.query;
    if (!svg_id) return res.status(400).json({ error: 'svg_id is required' });
    try {
        const result = await pool.query('SELECT * FROM access_mgmt.svg_files WHERE svg_id = $1', [svg_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'svg_file not found' });
        res.status(200).json({ svg_file: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    }
});

export default router;
export { hashPassword, verifyPassword, pool };
