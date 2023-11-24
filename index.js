import 'dotenv/config'
import express from 'express'
import expressValidator from 'express-validator'
import cors from 'cors'
import pg from 'pg'
import webPush from 'web-push'
import OtpCrypto from 'otp-crypto'

const { Client, types } = pg
const { body, param, query, matchedData, validationResult } = expressValidator

const AUTH_PREAMBLE = 'VERNAM'

const app = express()

let pushNotificationSupportEnabled
if (process.env.VAPID_CONTACT && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  pushNotificationSupportEnabled = true
  webPush.setVapidDetails(
    process.env.VAPID_CONTACT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
} else {
  pushNotificationSupportEnabled = false
  console.info('Push notification support disabled - at least one VAPID environment variable is not set.')
}

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

app.get('/messages/:receiver([\\S]{0,})',
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

    const timestamp = new Date().getTime()
    const sqlQueryString = 'INSERT INTO message (sender, receiver, payload, timestamp) VALUES ($1, $2, $3, $4) RETURNING sender, receiver, payload, timestamp'
    client.query(sqlQueryString, [data.sender, data.receiver, data.payload, timestamp], (error, result) => {
      if (error) {
        console.error(error)
        return res.status(500).end()
      }
      if (result.rows.length <= 0) {
        return res.status(500).end()
      }

      if (pushNotificationSupportEnabled) {
        client.query('SELECT endpoint FROM push_subscription WHERE receiver = $1', [data.receiver], (error, result) => {
          if (error) {
            console.error(error)
            return
          }
          for (const endpoint of result.rows.map(row => row.endpoint)) {
            webPush.sendNotification({ endpoint }).catch(error => {
              if (error?.statusCode === 410 && error?.endpoint != null) {
                client.query('DELETE FROM push_subscription WHERE receiver = $1 AND endpoint = $2', [data.receiver, error.endpoint], (error, result) => {
                  if (error) {
                    console.error(error)
                  }
                })
              } else {
                console.error(error)
              }
            })
          }
        })
      }

      return res.status(201).json(result.rows[0])
    })
  })

app.delete('/messages/:sender/:timestamp/:base64Key([\\S]{0,})',
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

app.get('/push-key',
  (req, res) => {
    if (process.env.VAPID_PUBLIC_KEY != null) {
      return res.status(200).json({ vapidPublicKey: process.env.VAPID_PUBLIC_KEY })
    }
    return res.status(500).end()
  })

app.post('/push-subscription',
  body('receiver').isString().trim().notEmpty(),
  body('endpoint').isURL({ protocols: ['https'] }),
  (req, res) => {
    const validation = validationResult(req)
    if (!validation.isEmpty()) {
      return res.status(400).json({ errors: validation.array() })
    }
    const data = matchedData(req)

    client.query('INSERT INTO push_subscription (receiver, endpoint) VALUES ($1, $2)', [data.receiver, data.endpoint], (error) => {
      if (error?.code === '23505') { // Duplicate insert
        return res.status(409).end()
      }
      if (error) {
        console.error(error)
        return res.status(500).end()
      }
      return res.status(201).end()
    })
  })

app.all('*', (req, res) => {
  return res.status(404).end()
})

app.listen(app.get('port'), () => {
  console.log('Node app is running on port', app.get('port'))
})
