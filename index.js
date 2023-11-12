import pg from 'pg'
import express from 'express'
import expressValidator from 'express-validator'
import cors from 'cors'
import OtpCrypto from 'otp-crypto'
import 'dotenv/config'

const { Client, types } = pg
const { body, param, query, matchedData, validationResult } = expressValidator

const AUTH_SECRET = 'VERNAM'
const SQL_TIMESTAMP_CLAUSE = 'CAST(floor(EXTRACT(EPOCH FROM timestamp) * 1000) AS BIGINT)'
const SQL_STRING_RETURNING = 'sender, receiver, payload, ' + SQL_TIMESTAMP_CLAUSE + ' AS timestamp'

const app = express()

types.setTypeParser(20, parseInt) // Parse timestamp to number instead of string, type 20 = BigInt

const client = new Client({
  connectionString: process.env.DATABASE_URL,
})

client.connect()

app.set('port', process.env.PORT || '3000')

app.use(cors({ maxAge: 600 }))

app.use(express.json())

app.get('/messages/:receiver',
  param('receiver').isString().notEmpty(),
  query('timestamp').optional().isInt(),
  (req, res) => {
    const validation = validationResult(req)
    if (!validation.isEmpty()) {
      return res.status(400).send({ errors: validation.array() })
    }
    const data = matchedData(req)

    const sqlTimestampClause = (data.timestamp != null) ? ' AND ' + SQL_TIMESTAMP_CLAUSE + ' > $2' : ''
    const sqlQueryParams = (data.timestamp != null) ? [data.receiver, data.timestamp] : [data.receiver]

    const sqlQueryString = 'SELECT ' + SQL_STRING_RETURNING + ' FROM message WHERE receiver = $1' + sqlTimestampClause + ' ORDER BY sender ASC, timestamp ASC'
    client.query(sqlQueryString, sqlQueryParams, (error, result) => {
      if (error) {
        console.error(error)
        res.status(500).end()
      } else {
        res.status(200).json(result.rows)
      }
    })
  })

app.post('/messages',
  body('sender').isByteLength({ max: 100 }).isString().trim().notEmpty(),
  body('receiver').isByteLength({ max: 100 }).isString().trim().notEmpty(),
  body('payload').isByteLength({ max: 1024 * 1024 }).isBase64().notEmpty(),
  (req, res) => {
    const validation = validationResult(req)
    if (!validation.isEmpty()) {
      return res.status(400).send({ errors: validation.array() })
    }
    const data = matchedData(req)

    const sqlQueryString = 'INSERT INTO message (sender, receiver, payload) VALUES ($1, $2, $3) RETURNING ' + SQL_STRING_RETURNING
    client.query(sqlQueryString, [data.sender, data.receiver, data.payload], (error, result) => {
      if (error) {
        console.error(error)
        res.status(500).end()
      } else if (result.rows.length <= 0) {
        res.status(500).end()
      } else {
        res.status(201).json(result.rows[0])
      }
    })
  })

app.delete('/messages/:sender/:timestamp/:base64Key',
  param('sender').isString().notEmpty(),
  param('timestamp').isInt(),
  param('base64Key').isBase64().notEmpty(),
  (req, res) => {
    const validation = validationResult(req)
    if (!validation.isEmpty()) {
      return res.status(400).send({ errors: validation.array() })
    }
    const data = matchedData(req)

    const sqlSelectionString = 'FROM message WHERE sender = $1 AND ' + SQL_TIMESTAMP_CLAUSE + ' = $2'
    client.query('SELECT payload ' + sqlSelectionString, [data.sender, data.timestamp], (error, result) => {
      if (error || result.rows.length <= 0) {
        console.error(error)
        res.status(400).end()
      } else {
        const messageWithAuthSecretEncrypted = result.rows[0].payload
        const authSecretKey = OtpCrypto.encryptedDataConverter.base64ToBytes(data.base64Key)
        if (OtpCrypto.decrypt(messageWithAuthSecretEncrypted, authSecretKey).plaintextDecrypted !== AUTH_SECRET) {
          res.status(200).end() // Do not let attacker know their supplied secret was incorrect
          return
        }
        client.query('DELETE ' + sqlSelectionString, [data.sender, data.timestamp], (error, result) => {
          if (error) {
            console.error(error)
            res.status(500).end()
          } else {
            res.status(200).end()
          }
        })
      }
    })
  })

app.get('*', (req, res) => {
  res.status(404).end()
})

app.listen(app.get('port'), () => {
  console.log('Node app is running on port', app.get('port'))
})
