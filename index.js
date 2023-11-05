const { Client, types } = require('pg')
const express = require('express')
const cors = require('cors')
const OtpCrypto = require('otp-crypto')

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

app.get('/messages/:receiver', function (request, response) {
  const sqlQueryString = 'SELECT ' + sqlStringReturning + ' FROM message WHERE receiver = $1 ORDER BY sender ASC, timestamp ASC'
  const queryParams = [request.params.receiver]
  client.query(sqlQueryString, queryParams, function (error, result) {
    if (error) {
      console.error(error)
      response.status(400).end()
    } else {
      response.json(result.rows)
    }
  })
})

app.post('/messages', function (request, response) {
  const sqlQueryString = 'INSERT INTO message (sender, receiver, payload) VALUES ($1, $2, $3) RETURNING ' + sqlStringReturning
  const queryParams = [request.body.sender, request.body.receiver, request.body.payload]
  client.query(sqlQueryString, queryParams, function (error, result) {
    if (error || result.rows.length <= 0) {
      console.error(error)
      response.status(400).end()
    } else {
      response.json(result.rows[0])
    }
  })
})

app.delete('/messages/:sender/:timestamp/:base64Key', function (request, response) {
  const sqlSelectionString = 'FROM message WHERE sender = $1 AND ' + timestampClause + ' = $2'
  const queryParams = [request.params.sender, request.params.timestamp]
  client.query('SELECT payload ' + sqlSelectionString, queryParams, function (error, result) {
    if (error || result.rows.length <= 0) {
      console.error(error)
      response.status(400).end()
    } else {
      const messageWithAuthSecretEncrypted = result.rows[0].payload
      const authSecretKey = OtpCrypto.encryptedDataConverter.base64ToBytes(request.params.base64Key)
      if (OtpCrypto.decrypt(messageWithAuthSecretEncrypted, authSecretKey).plaintextDecrypted !== AUTH_SECRET) {
        response.status(200).end()
        return
      }
      client.query('DELETE ' + sqlSelectionString, queryParams, function (error, result) {
        if (error) {
          console.error(error)
          response.status(400).end()
        } else {
          response.status(200).end()
        }
      })
    }
  })
})

app.get('*', function (request, response) {
  response.status(404).end()
})

app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'))
})
