# CCRT RSII Backend

## Configure environment
Copy `.env.example` to `.env` and fill values:
- NODE_ENV=production
- PORT=4000 (or your port)
- CORS_ORIGIN=https://yourdomain.com
- TRUST_PROXY=true (if behind Nginx/Cloudflare)
- SESSION_SECRET=strong-random-secret
- ADMIN_DEFAULT_PASSWORD=ChangeMe123!

## Install & run
```
npm ci
npm run start:prod
```

## Health check
- GET `/healthz` returns `{ status: 'ok' }` when DB is reachable.

## Security
- Helmet headers and rate limiting on login endpoints are enabled.
- Sessions use SQLite-based persistent store in `backend/sessions.sqlite`.

## Notes
- Ensure `backend/ccrt-rsii.db` is on persistent storage and backed up.
- In production, files matching debug/test patterns are blocked.
