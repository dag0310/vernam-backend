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

## Local development

- Use local version of database, the fly.io database only works internally, no external access.
- Run app: `npm run start`

## fly.io

Manage the app [vernam-backend on fly.io](https://fly.io/apps/vernam-backend).

### Setup Postgres DB structure
- `fly postgres connect -a vernam-backend-db`

### Setup app
- `fly secrets set DATABASE_URL=postgres://example.com/mydb`
- `fly secrets list`

### Deployment
- `fly deploy`
