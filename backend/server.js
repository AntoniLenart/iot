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
    res.json({ token, qrCode: qrDataUrl })

  } catch (err) {
    console.error(err)
    res.status(500).send("Error generating QR code")
  }
});

app.listen(PORT, () => {
    console.log(`Serwer działa na htpp://localhost:${PORT}`)
})