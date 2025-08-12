Deployment checklist

1) Environment
- Copy .env.example to .env and set values.
- Set a strong SESSION_SECRET.
- Set CORS_ORIGIN to your site origin(s).
- TRUST_PROXY=true if behind Nginx/Cloudflare.
- Optionally ENFORCE_HTTPS=true to redirect HTTP→HTTPS.

2) Install
- npm ci --omit=dev
- NODE_ENV=production

3) Process manager (example PM2)
- pm2 start index.js --name ccrt-rsii --time --update-env
- pm2 save
- pm2 startup

4) Reverse proxy (Nginx)
- Proxy / to http://127.0.0.1:4000
- Upgrade headers for websockets not needed here, but keep standard proxy headers.
- Issue Let\'s Encrypt cert with certbot.

5) Persistence & backup
- Ensure backend/ccrt-rsii.db and backend/sessions.sqlite are on persistent disk (not tmpfs/ephemeral).
- Regularly back up ccrt-rsii.db off the server.

6) JotForm config
- Thank You Redirect: https://yourdomain.com/api/jotform/thankyou?pid={participant_id}&fid={form_id}
- Webhook: POST to https://yourdomain.com/api/jotform/webhook

7) Prune dev pages in production
- Debug/test files matching /(debug|test).*(html|js|css)/ are blocked by the server in production. Optionally remove them from the build.

8) Health checks
- GET https://yourdomain.com/healthz should return { status: 'ok' }.
