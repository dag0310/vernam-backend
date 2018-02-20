const { Client } = require('pg');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const basicAuth = require('express-basic-auth')

const STATUS_CODES = {
  400: 'BAD REQUEST',
  404: 'NOT FOUND'
};

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

client.connect();

function returnCustomReponse(response, statusCode) {
  response.status(statusCode).json({code: statusCode, message: STATUS_CODES[statusCode]});
}

function myAsyncAuthorizer(username, password, cb) {
  client.query('SELECT auth_token FROM users WHERE phone_number = $1', [username], function (error, result) {
    cb(null, !error && result.rows.length > 0 && result.rows[0].auth_token === password);
  });
  return cb;
}

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

app.use(cors({ maxAge: 600 }))

app.use(bodyParser.json());

app.use(basicAuth({
  authorizer: myAsyncAuthorizer,
  authorizeAsync: true
}))

app.get('/messages', function (request, response) {
  client.query('SELECT id, sender, receiver, payload, floor(EXTRACT(EPOCH FROM timestamp) * 1000) AS timestamp FROM messages WHERE receiver = $1 ORDER BY timestamp ASC, id ASC', [request.auth.user], function (error, result) {
    if (error) {
      console.error(error);
      returnCustomReponse(response, 400);
    } else {
      response.json(result.rows);
    }
  });
});

app.post('/messages', function (request, response) {
  const queryParams = [request.auth.user, request.body.receiver, request.body.payload];
  client.query('INSERT INTO messages (sender, receiver, payload) VALUES ($1, $2, $3) RETURNING id, sender, receiver, payload, floor(EXTRACT(EPOCH FROM timestamp) * 1000) AS timestamp', queryParams, function (error, result) {
    if (error || result.rows.length <= 0) {
      console.error(error);
      returnCustomReponse(response, 400);
    } else {
      response.json(result.rows[0]);
    }
  });
});

app.delete('/messages/:id', function (request, response) {
  const queryParams = [request.params.id, request.auth.user];
  client.query('DELETE FROM messages WHERE id = $1 AND receiver = $2', queryParams, function (error, result) {
    if (error) {
      console.error(error);
      returnCustomReponse(response, 400);
    } else {
      response.json({});
    }
  });
});

app.get('*', function (request, response) {
  returnCustomReponse(response, 400);
});

app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'));
});
