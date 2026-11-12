# PicPac local order server

From `app`, run `npm --prefix server start`.
The operator page is at `http://localhost:8787/admin` and opens directly.
Orders and uploaded photos are saved in `server/data/` and remain after restart.

The web app uses `http://localhost:8787` by default. For a phone, set `EXPO_PUBLIC_API_URL` to the computer's LAN address and start the server with `HOST=0.0.0.0`. This is a pitch demo. Anyone who can reach the server can access its operator page, so keep it on your own computer or a trusted network. Public deployment needs HTTPS, account login, payment integration, backups, and server-side price validation.
