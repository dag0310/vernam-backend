const { Client } = require('pg');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

const ERRORS = {
  400: 'BAD REQUEST',
  404: 'NOT FOUND'
};

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

client.connect();

function doErrorResponse(response, statusCode) {
  response.status(statusCode || 400).json({code: statusCode, message: ERRORS[statusCode] || 'UNKNOWN ERROR'});
}

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json());

app.get('*', function (request, response) {
  doErrorResponse(response, 404);
});

app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'));
});
