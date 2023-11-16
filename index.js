import pg from 'pg'
import express from 'express'
import expressValidator from 'express-validator'
import cors from 'cors'
import OtpCrypto from 'otp-crypto'
import 'dotenv/config'

const { Client, types } = pg
const { body, param, query, matchedData, validationResult } = expressValidator

const AUTH_PREAMBLE = 'VERNAM'

const app = express()

types.setTypeParser(20, parseInt) // Parse timestamp to number instead of string, type 20 = BigInt

const client = new Client({
  connectionString: process.env.DATABASE_URL,
})

client.connect()

app.set('port', process.env.PORT || '3000')

app.use(cors({
  origin: process.env.CORS_ORIGIN || false,
  maxAge: 600,
}))

app.use(express.json())

app.get('/messages/:receiver',
  param('receiver').isString().notEmpty(),
  query('timestamp').optional().isInt(),
  (req, res) => {
    const validation = validationResult(req)
    if (!validation.isEmpty()) {
      return res.status(400).json({ errors: validation.array() })
    }
    const data = matchedData(req)

    const [sqlTimestampClause, sqlQueryParams] = (data.timestamp != null) ? [' AND timestamp > $2', [data.receiver, data.timestamp]] : ['', [data.receiver]]

    const sqlQueryString = 'SELECT sender, receiver, payload, timestamp FROM message WHERE receiver = $1' + sqlTimestampClause + ' ORDER BY sender ASC, timestamp ASC'
    client.query(sqlQueryString, sqlQueryParams, (error, result) => {
      if (error) {
        console.error(error)
        return res.status(500).end()
      }
      return res.status(200).json(result.rows)
    })
  })

app.post('/messages',
  body('sender').isString().trim().notEmpty(),
  body('receiver').isString().trim().notEmpty(),
  body('payload').isBase64().notEmpty(),
  (req, res) => {
    const validation = validationResult(req)
    if (!validation.isEmpty()) {
      return res.status(400).json({ errors: validation.array() })
    }
    const data = matchedData(req)

    const sqlQueryString = 'INSERT INTO message (sender, receiver, payload, timestamp) VALUES ($1, $2, $3, $4) RETURNING sender, receiver, payload, timestamp'
    client.query(sqlQueryString, [data.sender, data.receiver, data.payload, new Date().getTime()], (error, result) => {
      if (error) {
        console.error(error)
        return res.status(500).end()
      }
      if (result.rows.length <= 0) {
        return res.status(500).end()
      }
      return res.status(201).json(result.rows[0])
    })
  })

app.delete('/messages/:sender/:timestamp/:base64Key',
  param('sender').isString().notEmpty(),
  param('timestamp').isInt(),
  param('base64Key').isBase64().notEmpty(),
  (req, res) => {
    const validation = validationResult(req)
    if (!validation.isEmpty()) {
      return res.status(400).json({ errors: validation.array() })
    }
    const data = matchedData(req)

    client.query('SELECT payload FROM message WHERE sender = $1 AND timestamp = $2', [data.sender, data.timestamp], (error, result) => {
      if (error) {
        console.error(error)
        return res.status(500).end()
      }
      if (result.rows.length <= 0) {
        return res.status(404).end()
      }
      const paramByteKey = OtpCrypto.encryptedDataConverter.base64ToBytes(data.base64Key)
      const decryptedPayloadUsingParamByteKey = OtpCrypto.decrypt(result.rows[0].payload, paramByteKey)
      if (decryptedPayloadUsingParamByteKey.plaintextDecrypted !== AUTH_PREAMBLE) {
        return res.status(401).end()
      }
      client.query('DELETE FROM message WHERE sender = $1 AND timestamp = $2', [data.sender, data.timestamp], (error, result) => {
        if (error) {
          console.error(error)
          return res.status(500).end()
        }
        return res.status(200).end()
      })
    })
  })

app.all('*', (req, res) => {
  return res.status(404).end()
})

app.listen(app.get('port'), () => {
  console.log('Node app is running on port', app.get('port'))
})
