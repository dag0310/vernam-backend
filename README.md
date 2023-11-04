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

- Use a (local) development database. The fly.io database does not have external access enabled.
- Start dev server: `npm run start`

## fly.io

Manage [vernam-backend on fly.io](https://fly.io/apps/vernam-backend).

### Setup
- Set DB URL: `fly secrets set DATABASE_URL=postgres://example.com/mydb`
- Verify: `fly secrets list`

### Postgres login / Setup DB
- `fly postgres connect -a vernam-backend-db`
- Execute `database.sql` script to setup DB structure

### Deployment
- `fly deploy`
