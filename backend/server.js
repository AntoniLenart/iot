import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import QRCode from 'qrcode'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import escape from 'escape-html'
import rateLimit from 'express-rate-limit'
import databaseRoutes, { pool, createQR, hashPassword, verifyPassword } from './database.js';

const app = express()
const PORT = 4000
app.use('trust proxy', 1)

app.use(cors());
app.use(express.json())

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 API requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/', (req, res) => {
    res.send("Serwer Node.js działa\n")
})

/**
 * Wysyła email z kodem QR osadzonym jako obrazek inline.
 *
 * @async
 * @function sendEmailWithQR
 * @param {string} toEmail - Adres email odbiorcy.
 * @param {Buffer} qrBuffer - Bufor PNG zawierający obrazek kodu QR.
 *
 * @throws {Error} Zgłasza błąd, jeśli wysyłka emaila nie powiedzie się. Błąd jest logowany w konsoli.
 *
 * @example
 * import QRCode from 'qrcode';
 *
 * // Generowanie bufora QR code
 * const qrBuffer = await QRCode.toBuffer(JSON.stringify({ token: "abc123" }));
 *
 * // Wysyłka QR code mailem
 * await sendEmailWithQR('odbiorca@example.com', qrBuffer);
 *
 * @description
 * Funkcja wykorzystuje Nodemailer do wysyłki emaila przez SMTP Mailgun.
 * Kod QR jest wysyłany jako obrazek inline z użyciem identyfikatora Content-ID (`cid`),
 * dzięki czemu obrazek jest wyświetlany bezpośrednio w treści emaila

 * Transporter SMTP tworzony jest na podstawie zmiennych środowiskowych:
 * - MAILGUN_HOST
 * - MAILGUN_PORT
 * - MAILGUN_USER
 * - MAILGUN_PASS
 *
 * Email jest wysyłany z adresu `"QR Bot" <no-reply@sandbox...mailgun.org>`.
 * Wszelkie błędy podczas wysyłki są przechwytywane i logowane w konsoli.
 */
async function sendEmailWithQR(toEmail, qrBuffer, valid_from, valid_until, usage_limit) {
   try {
        const transporter = nodemailer.createTransport({
                host: process.env.MAILGUN_HOST,
                port: process.env.MAILGUN_PORT,
                secure: false,
                auth: {
                user: process.env.MAILGUN_USER,
                pass: process.env.MAILGUN_PASS,
                },
        })

        const mailOptions = {
                from: `"QR Bot" <no-reply@sandbox38b51b040f5245269855e3a71b96e05f.mailgun.org>`,
                to: toEmail,
                subject: 'Your generated QR code',
                html: `
                <h2>Hello!</h2>
                <p>Here’s your QR access code:</p>
                <img src="cid:qrcode_cid" alt="QR Code" />
                <hr />
                <h3>QR Code Details:</h3>
                <ul>
                  <li><strong>Valid from:</strong> ${valid_from}</li>
                  <li><strong>Valid until:</strong> ${valid_until}</li>
                  <li><strong>Usage limit:</strong> ${usage_limit}</li>
                </ul>
                <p>Please keep this email safe — the QR code will only work within the validity period and usage limit specified above.</p>
              `,

                attachments: [
                {
                        filename: 'qrcode.png',
                        content: qrBuffer,
                        cid: 'qrcode_cid', // this must match the img src
                },
                ],
        }

        const info = await transporter.sendMail(mailOptions)
         console.log('✅ Email sent successfully:', info.response)
   } catch (error) {
        console.error('❌ Failed to send email:', error)
   }
}

/**
 * POST /qrcode_generation
 *
 * Endpoint odbiera JSON od klienta, generuje losowy 32-znakowy token,
 * łączy go z danymi wejściowymi i zwraca QR Code w formacie Data URL.
 *
 * @param {import('express').Request} req - Obiekt żądania Express. JSON powinien być w req.body.
 *   JSON powinien zawierać pola:
 *     - RFID: hex (wymagane)
 *     - First_name: string (wymagane)
 *     - Last_name: string (wymagane)
 * @param {import('express').Response} res - Obiekt odpowiedzi Express. Zwraca JSON QR Code.
 *
 * @example
 * // Przykładowe wywołanie z użyciem axios
 * const axios = require('axios');
 *
 * axios.post('http://localhost:4000/qrcode_generation', { RFID: ..., First_name: ..., Last_name: ... })
 *   .then(res => console.log(res.data))
 *   .catch(err => console.error(err));
 *
 * @returns {Object} JSON z polami:
 *  - TODO
 */
const toUTCISOString = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? null : d.toISOString(); // always UTC
};

app.post('/qrcode_generation', async (req, res) => {
  try {
     // Validate required fields
    if (!req.body.valid_until) {
      return res.status(400).json({ error: "valid_until is required" });
    }

    const { recipient_info, email, valid_from, valid_until, usage_limit = 1, credential_id, metadata = {}, issued_by } = req.body;

    // Generate token
    const token = crypto.randomBytes(16).toString("hex");

    // Prepare QR code data
    const qrPayload = {
      code: token,
      credential_id: credential_id || null,
      valid_from: toUTCISOString(valid_from) || new Date().toISOString(),
      valid_until: toUTCISOString(valid_until),
      usage_limit,
      recipient_info: recipient_info || email || null,
      metadata: { ...metadata, token },
      issued_by: issued_by || null,
    };

    // Save QR to database
    const saved = await createQR(qrPayload);

    // Generate QR codes
    const stringData = JSON.stringify({ token });
    const qrTerminal = await QRCode.toString(stringData, { type: "terminal" });
    console.log(qrTerminal);

    const qrDataUrl = await QRCode.toDataURL(stringData);
    const qrBuffer = await QRCode.toBuffer(stringData);

    // Escape values for email
    const safeValidFrom = escape(qrPayload.valid_from);
    const safeValidUntil = escape(qrPayload.valid_until);
    const safeUsageLimit = escape(qrPayload.usage_limit.toString());

    // Send email if recipient is provided
    const recipientEmail = recipient_info || email;
    if (recipientEmail) {
      const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      if (!emailRegex.test(recipientEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      await sendEmailWithQR(
        recipientEmail,
        qrBuffer,
        safeValidFrom,
        safeValidUntil,
        safeUsageLimit
      );
    }

    res.status(201).json({ token, qrCode: qrDataUrl, qr_record: saved.qr });

  } catch (err) {
    console.error(err)
    res.status(500).send("Error generating QR code")
  }
});

/**
 * POST /login
 * Authenticate user with email and password.
 */
app.post('/login', apiLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    await pool.query('INSERT INTO access_mgmt.admin_audit (action, target_type, details, ip_address) VALUES ($1, $2, $3, $4)', ['login_failed', 'user', { email, reason: 'Missing email or password' }, req.ip]);
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM access_mgmt.users WHERE LOWER(email) = LOWER($1)', [email]);
    if (result.rowCount === 0) {
      await pool.query('INSERT INTO access_mgmt.admin_audit (action, target_type, details, ip_address) VALUES ($1, $2, $3, $4)', ['login_failed', 'user', { email, reason: 'User not found' }, req.ip]);
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      await pool.query('INSERT INTO access_mgmt.admin_audit (action, target_type, details, ip_address) VALUES ($1, $2, $3, $4)', ['login_failed', 'user', { email, reason: 'Invalid password' }, req.ip]);
      return res.status(401).json({ error: 'Invalid password' });
    }

    await pool.query('INSERT INTO access_mgmt.admin_audit (admin_user, action, target_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)', [user.user_id, 'login', 'user', user.user_id, { email }, req.ip]);
    res.json({ user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /logout
 * Log user logout.
 */
app.post('/logout', apiLimiter, async (req, res) => {
  const { user_id } = req.body;
  if (user_id) {
    try {
      await pool.query('INSERT INTO access_mgmt.admin_audit (admin_user, action, target_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)', [user_id, 'logout', 'user', user_id, {}, req.ip]);
    } catch (err) {
      console.error('Logout logging error:', err);
    }
  }
  res.json({ ok: true });
});

app.use('/api/v1', apiLimiter, databaseRoutes);

app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`)
})