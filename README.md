# Vernam Backend

Backend for the [Vernam](https://github.com/dag0310/vernam) messenger app.

## API

Please check the Express HTTP request endpoints in `index.js`

## Local development

- Use a (local) development database. The Fly.io database does not have external access enabled by default.
- VAPID environment variables are optionally for [web push notification](https://github.com/web-push-libs/web-push#command-line) support
- Set environment variables in `.env` file according to Fly.io template below, without `fly secrets set`
- Start dev server: `npm run dev`

## Fly.io setup

[Fly.io Dashboard](https://fly.io/dashboard)

### Environment variables
```bash
fly secrets set CORS_ORIGIN=https://example.com
fly secrets set DATABASE_URL=postgres://example.com/mydb
fly secrets set VAPID_CONTACT=EMAIL_OR_WEBSITE_STRING
fly secrets set VAPID_PUBLIC_KEY=BASE64_STRING
fly secrets set VAPID_PRIVATE_KEY=BASE64_STRING
```

Verify environment variables: `fly secrets list`

### Postgres login / Setup DB
- `fly postgres connect -a vernam-backend-db`
- Execute `database.sql` script to setup DB structure

### Deployment
- `fly deploy`
