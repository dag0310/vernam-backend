import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import pg from 'pg'
import webPush from 'web-push'
import OtpCrypto from 'otp-crypto'

const { Client, types } = pg

const AUTH_PREAMBLE = 'VERNAM'

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

if (process.env.DATABASE_URL == null) {
  console.error('Environment variable DATABASE_URL not set.')
}
const client = new Client({
  connectionString: process.env.DATABASE_URL,
})

client.connect()

const fastify = Fastify()

if (process.env.CORS_ORIGIN == null) {
  console.error('Environment variable CORS_ORIGIN not set.')
}
fastify.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || false,
  maxAge: 600,
})

const responseMessageSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    sender: { type: 'string' },
    receiver: { type: 'string' },
    payload: { type: 'string' },
    timestamp: { type: 'integer' },
  }
}
const sqlMessageColumns = Object.keys(responseMessageSchema.properties).join(', ')

fastify.get('/messages/:receiver', {
  schema: {
    params: {
      type: 'object',
      properties: {
        receiver: { type: 'string' },
      },
      required: ['receiver'],
    },
    query: {
      type: 'object',
      properties: {
        timestamp: { type: 'integer' },
      },
    },
    response: {
      200: {
        type: 'array',
        items: responseMessageSchema,
      },
    },
  }
}, async (request, reply) => {
  const [sqlTimestampClause, sqlQueryParams] = (request.query.timestamp != null)
    ? [' AND timestamp > $2', [request.params.receiver, request.query.timestamp]]
    : ['', [request.params.receiver]]

  const sqlQueryString = 'SELECT ' + sqlMessageColumns + ' FROM message WHERE receiver = $1' + sqlTimestampClause + ' ORDER BY timestamp ASC'

  try {
    const result = await client.query(sqlQueryString, sqlQueryParams)
    return reply.code(200).send(result.rows)
  } catch (error) {
    console.error(error)
    return reply.code(500).send(error)
  }
})

fastify.post('/messages', {
  schema: {
    body: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        sender: { type: 'string', format: 'uuid' },
        receiver: { type: 'string', format: 'uuid' },
        payload: { type: 'string', format: 'byte' },
      },
      required: ['id', 'sender', 'receiver', 'payload'],
    },
    response: {
      200: responseMessageSchema,
      201: responseMessageSchema,
    },
  },
}, async (request, reply) => {
  const result = await client.query('SELECT ' + sqlMessageColumns + ' FROM message WHERE id = $1', [request.body.id])
  if (result.rows.length > 0) {
    return reply.code(200).send(result.rows[0])
  }

  const sqlQueryString = 'INSERT INTO message (id, sender, receiver, payload, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING ' + sqlMessageColumns
  const sqlQueryParams = [request.body.id, request.body.sender, request.body.receiver, request.body.payload, new Date().getTime()]

  try {
    const result = await client.query(sqlQueryString, sqlQueryParams)

    if (result.rows.length <= 0) {
      return reply.code(500).send({ message: 'Message creation failed.' })
    }
    const resultRow = result.rows[0]

    if (pushNotificationSupportEnabled) {
      try {
        const result = await client.query('SELECT endpoint FROM push_subscription WHERE receiver = $1', [request.body.receiver])
        for (const endpoint of result.rows.map(row => row.endpoint)) {
          webPush.sendNotification({ endpoint }).catch(async error => {
            if (error?.statusCode === 410 && error?.endpoint != null) {
              try {
                await client.query('DELETE FROM push_subscription WHERE receiver = $1 AND endpoint = $2', [request.body.receiver, error.endpoint])
              } catch (error) {
                console.error(error)
              }
            } else {
              console.error(error)
            }
          })
        }
      } catch (error) {
        console.error(error)
      }
    }

    return reply.code(201).send(resultRow)
  } catch (error) {
    if (error?.code === '23505') {
      return reply.code(409).send(error)
    }
    console.error(error)
    return reply.code(500).send(error)
  }
})

fastify.delete('/messages/:id/:base64Key', {
  schema: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        base64Key: { type: 'string', format: 'byte' },
      },
      required: ['id', 'base64Key'],
    },
  },
}, async (request, reply) => {
  try {
    const result = await client.query('SELECT payload FROM message WHERE id = $1', [request.params.id])

    if (result.rows.length <= 0) {
      return reply.code(404).send({ message: 'Message not found.' })
    }
    const resultRow = result.rows[0]

    const paramByteKey = OtpCrypto.encryptedDataConverter.base64ToBytes(request.params.base64Key)
    const decryptedPayloadUsingParamByteKey = OtpCrypto.decrypt(resultRow.payload, paramByteKey)
    if (decryptedPayloadUsingParamByteKey.plaintextDecrypted !== AUTH_PREAMBLE) {
      return reply.code(401).send({ message: 'Message authentication failed.' })
    }

    await client.query('DELETE FROM message WHERE id = $1', [request.params.id])

    return reply.code(200).send()
  } catch (error) {
    console.error(error)
    return reply.code(500).send(error)
  }
})

fastify.get('/push-key', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          vapidPublicKey: { type: 'string' },
        },
      },
    },
  },
}, async (request, reply) => {
  if (process.env.VAPID_PUBLIC_KEY == null) {
    return reply.code(500).send({ message: 'No VAPID public key set.' })
  }
  return reply.code(200).send({ vapidPublicKey: process.env.VAPID_PUBLIC_KEY })
})

fastify.post('/push-subscription', {
  schema: {
    body: {
      type: 'object',
      properties: {
        receiver: { type: 'string', format: 'uuid' },
        endpoint: { type: 'string', format: 'uri' },
      },
      required: ['receiver', 'endpoint'],
    },
  },
}, async (request, reply) => {
  try {
    await client.query('INSERT INTO push_subscription (receiver, endpoint) VALUES ($1, $2)', [request.body.receiver, request.body.endpoint])
    return reply.code(201).send()
  } catch (error) {
    if (error?.code === '23505') {
      return reply.code(409).send(error)
    }
    console.error(error)
    return reply.code(500).send(error)
  }
})

;(async () => {
  const port = process.env.PORT ?? 3000
  const host = '0.0.0.0'
  const address = await fastify.listen({ port, host })
  console.info(`Server listening on ${address}`)
})()
