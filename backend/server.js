import express from 'express'
import QRCode from 'qrcode'
import psql from 'pg'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

const { Client } = psql
const app = express()
const PORT = 4000

app.use(express.json())

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
    const inputData = req.body
    const token = crypto.randomBytes(16).toString('hex')

    const combinedData = { ...inputData, token }
    const stringData = JSON.stringify(combinedData)

    // Dla testów
    const qrTerminal = await QRCode.toString(stringData, { type: 'terminal' });
    console.log(qrTerminal);

    const qrDataUrl = await QRCode.toDataURL(stringData)
    const qrBuffer = await QRCode.toBuffer(stringData);

    res.json({ token, qrCode: qrDataUrl })

    /* Wysylanie maila z wygenerowanym wczesniej kodem QR */
    if(req.body.email){
        await sendEmailWithQR(req.body.email, qrBuffer)
    }


  } catch (err) {
    console.error(err)
    res.status(500).send("Error generating QR code")
  }
});

app.listen(PORT, () => {
    console.log(`Serwer działa na htpp://localhost:${PORT}`)
})