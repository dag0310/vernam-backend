import pg from 'pg';
import express from 'express'
import expressValidator from 'express-validator'
import cors from 'cors'
import OtpCrypto from 'otp-crypto'
import 'dotenv/config'

const { Client, types } = pg
const { body, param, query, matchedData, validationResult } = expressValidator

const app = express()

const AUTH_SECRET = 'VERNAM'

types.setTypeParser(20, parseInt); // Parse timestamp to number instead of string, type 20 = BigInt

const client = new Client({
  connectionString: process.env.DATABASE_URL,
})

client.connect()

app.set('port', process.env.PORT || '3000')

app.use(cors({ maxAge: 600 }))

app.use(express.json())

const timestampClause = 'CAST(floor(EXTRACT(EPOCH FROM timestamp) * 1000) AS BIGINT)'
const sqlStringReturning = 'sender, receiver, payload, ' + timestampClause + ' AS timestamp'

app.get('/messages/:receiver',
param('receiver').isString().notEmpty(),
query('timestamp').optional().isInt(),
function (req, res) {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    return res.status(400).send({ errors: validation.array() });
  }
  const data = matchedData(req)

  const timestamp = (data.timestamp != null) ? data.timestamp : 0

  const sqlQueryString = 'SELECT ' + sqlStringReturning + ' FROM message WHERE receiver = $1 AND ' + timestampClause + ' > $2 ORDER BY sender ASC, timestamp ASC'
  client.query(sqlQueryString, [data.receiver, timestamp], function (error, result) {
    if (error) {
      console.error(error)
      res.status(400).end()
    } else {
      res.json(result.rows)
    }
  })
})

app.post('/messages',
body('sender').isByteLength({ max: 100 }).isString().trim().notEmpty(),
body('receiver').isByteLength({ max: 100 }).isString().trim().notEmpty(),
body('payload').isByteLength({ max: 1024 * 1024 }).isBase64().notEmpty(),
function (req, res) {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    return res.status(400).send({ errors: validation.array() });
  }
  const data = matchedData(req)

  const sqlQueryString = 'INSERT INTO message (sender, receiver, payload) VALUES ($1, $2, $3) RETURNING ' + sqlStringReturning
  client.query(sqlQueryString, [data.sender, data.receiver, data.payload], function (error, result) {
    if (error || result.rows.length <= 0) {
      console.error(error)
      res.status(400).end()
    } else {
      res.json(result.rows[0])
    }
  })
})

app.delete('/messages/:sender/:timestamp/:base64Key',
body('sender').isString().notEmpty(),
body('timestamp').isInt(),
body('base64Key').isBase64().notEmpty(),
function (req, res) {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    return res.status(400).send({ errors: validation.array() });
  }
  const data = matchedData(req)

  const sqlSelectionString = 'FROM message WHERE sender = $1 AND ' + timestampClause + ' = $2'
  client.query('SELECT payload ' + sqlSelectionString, [data.sender, data.timestamp], function (error, result) {
    if (error || result.rows.length <= 0) {
      console.error(error)
      res.status(400).end()
    } else {
      const messageWithAuthSecretEncrypted = result.rows[0].payload
      const authSecretKey = OtpCrypto.encryptedDataConverter.base64ToBytes(data.base64Key)
      if (OtpCrypto.decrypt(messageWithAuthSecretEncrypted, authSecretKey).plaintextDecrypted !== AUTH_SECRET) {
        res.status(200).end()
        return
      }
      client.query('DELETE ' + sqlSelectionString, queryParams, function (error, result) {
        if (error) {
          console.error(error)
          res.status(400).end()
        } else {
          res.status(200).end()
        }
      })
    }
  })
})

app.get('*', function (req, res) {
  res.status(404).end()
})

app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'))
})
