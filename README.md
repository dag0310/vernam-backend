# Vernam Backend

Backend for the [Vernam](https://github.com/dag0310/vernam) perfect secrecy messenger app.

## API
```
GET /messages/873e55b9-5f40-43f2-b026-d4867511810f
Response body:
{
  "sender": "bd8ebf34-4214-46a7-ab55-60c4eee0c20d",
  "receiver": "873e55b9-5f40-43f2-b026-d4867511810f",
  "payload": "DEF=="
}

POST /messages
Request body:
{
  "sender": "bd8ebf34-4214-46a7-ab55-60c4eee0c20d",
  "receiver": "873e55b9-5f40-43f2-b026-d4867511810f",
  "payload": "DEF=="
}
Response body:
{
  "sender": "bd8ebf34-4214-46a7-ab55-60c4eee0c20d",
  "receiver": "873e55b9-5f40-43f2-b026-d4867511810f",
  "payload": "DEF==",
  "timestamp": 1519322973101
}

DELETE /messages/bd8ebf34-4214-46a7-ab55-60c4eee0c20d/1519322973101/KEY=
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
