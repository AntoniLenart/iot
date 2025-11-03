import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

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
    const { first_name, last_name, email, phone, user_type = 'employee', department, employee_number } = req.body;
    if (!first_name || !last_name) {
        return res.status(400).json({ error: 'first_name and last_name are required' });
    }

    try {
        const insertQuery = `
      INSERT INTO access_mgmt.users (first_name, last_name, email, phone, user_type, department, employee_number)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING user_id, first_name, last_name, email, phone, user_type, department, employee_number, created_at;
    `;
        const result = await pool.query(insertQuery, [
            first_name, last_name, email || null, phone || null,
            user_type, department || null, employee_number || null
        ]);
        res.status(201).json({ user: result.rows[0] });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
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
    const { user_id, ...fields } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const allowed = ['username','first_name','last_name','email','phone','user_type','department','employee_number','is_active','metadata'];
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

    const sql = `UPDATE access_mgmt.users SET ${sets.join(', ')} WHERE user_id = $${idx} RETURNING *`;
    values.push(user_id);

    try {
        const result = await pool.query(sql, values);
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

router.post('/qr/create', ensureJson, async (req, res) => {
    const { code, credential_id, valid_from, valid_until, usage_limit, recipient_info, metadata } = req.body;
    if (!valid_until) return res.status(400).json({ error: 'valid_until is required' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let credId = credential_id || null;
        const tokenVal = metadata.token || null;
        if (!credId) {
            // create a placeholder credential tied to no user (external token)
            const credRes = await client.query(
                `INSERT INTO access_mgmt.credentials (user_id, credential_type, identifier, issued_by, issued_at, expires_at, is_active, token_value)
                 VALUES ($1,$2,$3,$4,now(),$5,$6,$7) RETURNING credential_id`,
                [null, 'qr_code', null, null, valid_until, true, tokenVal]
            );
            credId = credRes.rows[0].credential_id;
        } else {
            // update existing credential token_value and expires_at
            await client.query(
                `UPDATE access_mgmt.credentials SET token_value = $1, expires_at = $2 WHERE credential_id = $3`,
                [tokenVal, valid_until, credId]
            );
        }

        const insert = `INSERT INTO access_mgmt.qr_codes (code, credential_id, created_at, valid_from, valid_until, usage_limit, usage_count, is_active, recipient_info)
                        VALUES (COALESCE($1, gen_random_uuid()::text), $2, now(), COALESCE($3, now()), $4, $5, 0, true, $6) RETURNING *`;
        const values = [code || null, credId, valid_from || null, valid_until, usage_limit || 1, recipient_info || null];
        const result = await client.query(insert, values);

        await client.query('COMMIT');
        res.status(201).json({ qr: result.rows[0], credential_id: credId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('DB error:', err);
        res.status(500).json({ error: 'database error' });
    } finally {
        client.release();
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

export default router;
