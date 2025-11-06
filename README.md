# Vernam Backend
Backend for the [Vernam](https://github.com/dag0310/vernam) messenger app.

## API
Please check the HTTP request endpoints in `index.js`

## Deployment
- Run as node service in production: `pm2 start index.js --name vernam-backend`

## Local development
- Use a (local) development database.
- VAPID environment variables are optionally for [web push notification](https://github.com/web-push-libs/web-push#command-line) support
- Set environment variables in `.env` file according to .env.example
- Start dev server: `npm run dev`

### Postgres login / Setup DB
- Execute `database.sql` script to setup DB structure