// access-service.js
import express from 'express'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import pkg from 'pg';
import cors from 'cors'
const { Pool } = pkg;

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())
app.set('trust proxy', 1)

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // max requests per IP
  message: {
    error: "Too many requests from this IP, please try again later."
  },
  standardHeaders: true, // return rate limit info in headers
  legacyHeaders: false,   // disable `X-RateLimit-*` headers
});

app.use(apiLimiter); 

// --- Postgres ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: { rejectUnauthorized: false }
});
await pool.connect().then(c => c.release()) // szybki healthcheck

const ENROLL_WINDOW_MS = 30_000;
let enrollOpenUntil = 0;

let rfidEnrollClient = null;
let biometricEnrollClient = null;

app.get("/frontend/rfid", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  rfidEnrollClient = res;
  console.log("[SSE] frontend connected (RFID)");

  req.on("close", () => {
    if (rfidEnrollClient === res) rfidEnrollClient = null;
    console.log("[SSE] frontend disconnected (RFID)");
  });
});

app.get("/frontend/biometric", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  biometricEnrollClient = res;
  console.log("[SSE] frontend connected (biometric)");

  req.on("close", () => {
    if (biometricEnrollClient === res) biometricEnrollClient = null;
    console.log("[SSE] frontend disconnected (biometric)");
  });
});

app.post("/enroll/start", (req, res) => {
  enrollOpenUntil = Date.now() + ENROLL_WINDOW_MS;
  console.log(`[ENROLL] Window opened for ${ENROLL_WINDOW_MS / 1000}s`);
  res.json({ ok: true, until: enrollOpenUntil });
});

function mapType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "rfid" || t === "rfid_card") return "rfid";
  if (t === "qr" || t === "qr_code") return "qr";
  if (t === "fingerprint" || t === "finger_print") return "fingerprint";
  return null;
}

async function checkAccess(doorName, type, identifier) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT access_mgmt.check_access($1,$2,$3, now()) AS allowed",
      [doorName, type, identifier]
    );
    return rows[0]?.allowed === true;
  } finally {
    client.release();
  }
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "access-service" });
});

app.post("/access-check", async (req, res) => {
  try {
    const { door_id, type, data } = req.body || {};

    if (!door_id || !type || data === undefined) {
      return res.status(400).json({
        status: "deny",
        reason: "missing_parameters",
      });
    }

    const now = Date.now();
    const normalizedType = mapType(type);
    const identifier = String(data);

    if (door_id === "add") {
      if (now > enrollOpenUntil) {
        console.log("[ENROLL] attempt outside window – denied");
        return res.json({ status: "deny", reason: "enroll_window_closed" });
      }

      const payload = JSON.stringify({
        data: identifier,
        type: normalizedType,
      });

      if (normalizedType === "rfid" && rfidEnrollClient) {
        rfidEnrollClient.write(`data: ${payload}\n\n`);
        console.log("[ENROLL] RFID sent to frontend");
      }

      if (normalizedType === "fingerprint" && biometricEnrollClient) {
        biometricEnrollClient.write(`data: ${payload}\n\n`);
        console.log("[ENROLL] Fingerprint sent to frontend");
      }

      return res.json({ status: "ok", mode: "enroll" });
    }

    if (normalizedType === "fingerprint") {
      return res.json({
        status: "deny",
        reason: "fingerprint_not_supported_yet",
      });
    }

     const allowed = await checkAccess(door_id, normalizedType, identifier);

    console.log(
      `[ACCESS] door=${door_id} type=${normalizedType} id=${identifier} -> ${allowed ? "ALLOW" : "DENY"}`
    );

    return res.json({
      status: allowed ? "allow" : "deny",
      door_id,
    });
  } catch (err) {
    console.error("access-check error:", err);
    return res.status(500).json({ status: "deny", reason: "server_error" });
  }
});

const PORT = Number(process.env.ACCESS_SVC_PORT || 4001);
app.listen(PORT, () => {
  console.log(`Access service listening on http://127.0.0.1:${PORT}`);
});