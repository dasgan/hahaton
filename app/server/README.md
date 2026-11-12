# PicPac local order server

From `app`, run `ADMIN_TOKEN=<private-password> npm --prefix server start`.
The operator page is at `http://localhost:8787/admin`. Enter the same password there.
Orders and uploaded photos are saved in `server/data/` and remain after restart.

The web app uses `http://localhost:8787` by default. For a phone, set `EXPO_PUBLIC_API_URL` to the computer's LAN address and start the server with `HOST=0.0.0.0`. Keep the server on a trusted network. Public deployment needs HTTPS, account login, payment integration, backups, and server-side price validation.
