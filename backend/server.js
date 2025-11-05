import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import QRCode from 'qrcode'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import databaseRoutes, { pool, createQR, hashPassword, verifyPassword } from './database.js';

const app = express()
const PORT = 4000

app.use(cors());
app.use(express.json())

// Removed local definitions of hashPassword and verifyPassword

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
async function sendEmailWithQR(toEmail, qrBuffer) {
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
                <p>Here’s your QR access code</p>
                <img src="cid:qrcode_cid" alt="QR Code" />
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
 * POST /access-check
 * Endpoint służący do odbierania danych w formacie JSON od klienta.
 *
 * @param {import('express').Request} req - Obiekt żądania Express, zawiera JSON w req.body
 * @param {import('express').Response} res - Obiekt odpowiedzi Express, wysyła potwierdzenie w JSON
 *
 * @example
 * // Przykład wywołania endpointu po stronie klienta przy użyciu axios
 * const axios = require('axios');
 *
 * axios.post('http://localhost:4000/open_request', { type: rfid/qrcode/biometry, data: '...', door_id: '...' })
 *   .then(res => console.log(res.data))
 *   .catch(err => console.error(err));
 *
 * @returns {Object} JSON z wiadomością potwierdzającą odebranie danych oraz przesłanymi danymi
 */

app.post('/access-check', (req, res) => {
  const receivedData = req.body;
  console.log('Otrzymano POST:', receivedData);

  res.json({
    status: 'allow',
    door_id: receivedData.door_id
    });
});

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
app.post('/qrcode_generation', async (req, res) => {
  try {
    if (!req.body.valid_until) return res.status(400).json({ error: 'valid_until is required' });

    const inputData = req.body
    const token = crypto.randomBytes(16).toString('hex')

    const combinedData = { ...inputData, token }
    const stringData = JSON.stringify(combinedData)

    // Dla testów
    const qrTerminal = await QRCode.toString(stringData, { type: 'terminal' });
    console.log(qrTerminal);

    const qrDataUrl = await QRCode.toDataURL(stringData)
    const qrBuffer = await QRCode.toBuffer(stringData);

    // Zapis do bazy przez bezpośrednie wywołanie funkcji z database.js
    const qrPayload = {
      code: qrDataUrl,
      credential_id: req.body.credential_id || null,
      valid_from: req.body.valid_from || null,
      valid_until: req.body.valid_until,
      usage_limit: req.body.usage_limit || 1,
      recipient_info: req.body.recipient_info || req.body.email || null,
      metadata: Object.assign({}, req.body.metadata || {}, { token }),
      issued_by: req.body.issued_by || null
    };

    const saved = await createQR(qrPayload);

    /* Wysylanie maila z wygenerowanym wczesniej kodem QR */
    if(req.body.email){
        await sendEmailWithQR(req.body.email, qrBuffer)
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
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    await pool.query('INSERT INTO access_mgmt.admin_audit (action, target_type, details, ip_address) VALUES ($1, $2, $3, $4)', ['login_failed', 'user', { email, reason: 'Missing email or password' }, req.ip]);
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM access_mgmt.users WHERE LOWER(email) = LOWER($1)', [email]);
    if (result.rowCount === 0) {
      await pool.query('INSERT INTO access_mgmt.admin_audit (action, target_type, details, ip_address) VALUES ($1, $2, $3, $4)', ['login_failed', 'user', { email, reason: 'User not found' }, req.ip]);
      console.log('Login attempt: User not found for email:', email);
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    console.log('Login attempt: User found:', user.email, 'Hash exists:', !!user.password_hash);

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      await pool.query('INSERT INTO access_mgmt.admin_audit (action, target_type, details, ip_address) VALUES ($1, $2, $3, $4)', ['login_failed', 'user', { email, reason: 'Invalid password' }, req.ip]);
      console.log('Login attempt: Password verification failed for user:', user.email);
      return res.status(401).json({ error: 'Invalid password' });
    }

    await pool.query('INSERT INTO access_mgmt.admin_audit (admin_user, action, target_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)', [user.user_id, 'login', 'user', user.user_id, { email }, req.ip]);
    console.log('Login attempt: Success for user:', user.email);
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
app.post('/logout', async (req, res) => {
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

app.use('/api/v1', databaseRoutes);

app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`)
})