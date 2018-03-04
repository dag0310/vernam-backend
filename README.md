# Vernam Backend

Backend for the [Vernam](https://github.com/dag0310/vernam) perfect secrecy messenger app.

## API
```
GET /messages/+436641234567
Response body:
{
	"sender": "+436801234567",
	"receiver": "+436641234567",
	"payload": "DEF=="
}

POST /messages
Request body:
{
	"sender": "+436801234567",
	"receiver": "+436641234567",
	"payload": "DEF=="
}
Response body:
{
	"sender": "+436801234567",
	"receiver": "+436641234567",
	"payload": "DEF==",
	"timestamp": 1519322973101
}

DELETE /messages/+436801234567/1519322973101/KEY=
Response body:
{}
```

## Setup

Install the [Heroku client](https://devcenter.heroku.com/articles/heroku-cli) first.

``` bash
# Install dependencies
npm install

# Log into heroku with your credentials
heroku login

# Run locally on port 5000
nodemon --exec "heroku local" --signal SIGTERM

# Connect to database
heroku pg:psql
```