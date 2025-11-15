// access-service.js
import express from 'express'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config()

const app = express()
app.use(express.json())
app.use(apiLimiter); 

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max requests per IP
  message: {
    error: "Too many requests from this IP, please try again later."
  },
  standardHeaders: true, // return rate limit info in headers
  legacyHeaders: false,   // disable `X-RateLimit-*` headers
});

// --- Postgres ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: { rejectUnauthorized: false }
});
await pool.connect().then(c => c.release()) // szybki healthcheck

// --- Okno rejestracji dla drzwi "add" ---
const ENROLL_WINDOW_MS = (Number(process.env.ENROLL_WINDOW_SEC || 15)) * 1000
let enrollOpenUntil = 0 // timestamp ms

function mapTypeToDb(typ) {
  if (!typ) return null
  const t = String(typ).toLowerCase()
  if (t === 'rfid') return 'rfid_card'
  if (t === 'finger_print' || t === 'fingerprint') return 'fingerprint'
  if (t === 'qr' || t === 'qr_code') return 'qr_code'
  return null
}

// --- helpery DB ---
async function verifyRfid(identifier) {
  const sql = `
    SELECT 1 FROM access_mgmt.credentials
     WHERE credential_type='rfid_card' AND identifier=$1 AND is_active=true
    LIMIT 1`
  const { rows } = await pool.query(sql, [identifier])
  return rows.length > 0
}

async function verifyFingerprint(identifier) {
  const sql = `
    SELECT 1 FROM access_mgmt.credentials
     WHERE credential_type='fingerprint' AND identifier=$1 AND is_active=true
    LIMIT 1`
  const { rows } = await pool.query(sql, [identifier])
  return rows.length > 0
}

async function verifyQr(code) {
  const sql = `
    SELECT 1 FROM access_mgmt.qr_codes
     WHERE code=$1 AND is_active=true
       AND now() BETWEEN valid_from AND valid_until
       AND (usage_limit IS NULL OR usage_count < usage_limit)
    LIMIT 1`
  const { rows } = await pool.query(sql, [code])
  return rows.length > 0
}

async function bumpQrUsage(code) {
  const sql = `
    UPDATE access_mgmt.qr_codes
       SET usage_count = usage_count + 1
     WHERE code=$1
       AND is_active=true
       AND now() BETWEEN valid_from AND valid_until`
  await pool.query(sql, [code])
}

async function enrollCredential(credTypeDb, data) {
  if (credTypeDb === 'rfid_card' || credTypeDb === 'fingerprint') {
    const sql = `
      INSERT INTO access_mgmt.credentials (credential_type, identifier, is_active)
      VALUES ($1, $2, true)
      ON CONFLICT (credential_type, identifier)
      DO UPDATE SET is_active=true, issued_at=now()
      RETURNING credential_id`
    const { rows } = await pool.query(sql, [credTypeDb, data])
    return rows[0]?.credential_id || null
  }
  return null // qr_code nie rejestrujemy tą ścieżką
}

// --- API ---
app.get('/health', async (req, res) => {
  res.json({
    ok: true,
    enrollOpenUntil,
    now: Date.now(),
    windowOpen: Date.now() <= enrollOpenUntil
  })
})

// Otwórz okno rejestracji dla "add" (wywołuje Frontend)
app.post('/enroll/start', (req, res) => {
  enrollOpenUntil = Date.now() + ENROLL_WINDOW_MS
  console.log(`[enroll] window open for ${ENROLL_WINDOW_MS/1000}s until`, new Date(enrollOpenUntil).toISOString())
  res.json({ ok: true, until: enrollOpenUntil })
})

// Decyzje dla main/hr oraz zapis dla add
app.post('/access-check', async (req, res) => {
  try {
    const { type, data, door_id } = req.body || {}
    console.log('[access-check] input:', req.body)

    if (!type || !data || !door_id) {
      return res.status(400).json({ error: 'missing type | data | door_id' })
    }

    const credTypeDb = mapTypeToDb(type)
    if (!credTypeDb) {
      return res.status(400).json({ error: 'unknown type', door_id })
    }

    // --- gałąź rejestracji ---
    if (door_id === 'add') {
      if (Date.now() <= enrollOpenUntil) {
        const credId = await enrollCredential(credTypeDb, String(data))
        console.log('[enroll] stored credential:', credTypeDb, data, 'id:', credId)
        // bez statusu (Python nic nie publikuje dla add)
        return res.json({ ok: true, door_id, credential_id: credId })
      } else {
        return res.status(202).json({ ok: false, door_id, reason: 'enroll window closed' })
      }
    }
     // --- weryfikacja main/hr ---
    let allowed = false
    if (credTypeDb === 'rfid_card') {
      allowed = await verifyRfid(String(data))
    } else if (credTypeDb === 'fingerprint') {
      allowed = await verifyFingerprint(String(data))
    } else if (credTypeDb === 'qr_code') {
      allowed = await verifyQr(String(data))
      if (allowed) await bumpQrUsage(String(data))
    }

    const status = allowed ? 'allow' : 'deny'
    return res.json({ status, door_id })

  } catch (e) {
    console.error('[access-check] error:', e)
    return res.status(500).json({ error: 'internal' })
  }
})

const PORT = Number(process.env.ACCESS_SVC_PORT || 4001)

app.listen(PORT, () => {
  console.log(`Access service listening on http://127.0.0.1:${PORT}`)
})
