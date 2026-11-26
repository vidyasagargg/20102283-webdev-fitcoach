# Deployment: MongoDB Atlas + Render

The production setup is a single Render web service (Node 22) that serves the API and the built React app,
connected to a MongoDB Atlas cluster. Both have free tiers. Total time is about 20 minutes.

```
GitHub (main) --push--> GitHub Actions CI --pass--> Render build: npm ci --include=dev && npm run build
                                                     Render start: npm start  -->  https://fitcoach-xxxx.onrender.com
                                                                                     |
                                                                         MongoDB Atlas (TLS, IP allow-list, SCRAM auth)
```

## 1. Push the code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/fitcoach.git
git push -u origin main
```

Commit in small, meaningful steps as you continue to work on the project; the brief marks commit history.

## 2. Create the database (MongoDB Atlas)

1. Sign up at <https://www.mongodb.com/cloud/atlas> and create a free **M0** cluster (pick a region near your Render region, e.g. Frankfurt).
2. **Database Access** → *Add New Database User* → use a generated password and grant the `readWrite` role on the `fitcoach` database.
3. **Network Access** → *Add IP Address* → add the CIDR ranges listed in **Connect → Outbound** for the actual Render service. See [Render outbound IP documentation](https://render.com/docs/outbound-ip-addresses).
4. **Connect** → *Drivers* → copy the URI and add the database name:
   `mongodb+srv://fitcoach:<password>@cluster0.xxxxx.mongodb.net/fitcoach?retryWrites=true&w=majority`

## 3. Create the web service (Render)

1. Sign up at <https://render.com> with GitHub.
2. **New → Blueprint** → pick the repository. Render reads `render.yaml` and creates the `fitcoach` service
   (it also generates a strong `JWT_SECRET`).
3. Fill in the secret variables it asks for:

| Variable | Value |
|---|---|
| `MONGODB_URI` | the Atlas URI from step 2 |
| `CLIENT_ORIGIN` | your Render URL, e.g. `https://fitcoach-xxxx.onrender.com` |
| `USDA_API_KEY` | free key from <https://fdc.nal.usda.gov/api-key-signup> (or `DEMO_KEY`) |
| `ANTHROPIC_API_KEY` | optional: leave empty to use the rule-based coach |

4. Deploy. When the log shows `Connected to MongoDB` and `listening`, open the URL.
5. **Settings → Build & Deploy → Auto-Deploy: "After CI checks pass"** so only tested commits go live.

## 4. Provision an administrator or run the local demo

In production, have the intended administrator create an account through the normal sign-up. Verify ownership, then update that account's `role` to `admin` in Atlas. Sign in to open `/admin`. Public sign-up creates regular production accounts regardless of `ADMIN_EMAILS`.

Run `npm run demo` to try the portal with `admin@fitcoach.app` and password `DemoPass123` in the local in-memory demo. Demo administrator addresses are blocked from the production admin API.

To add the 20 synthetic members and the dedicated `vidyaadmin@fitcoach.app` administrator to `fitcoach_dev`, supply `FITCOACH_SEED_MONGODB_URI` and `FITCOACH_SEED_ADMIN_PASSWORD` in the process environment or the ignored `server/.env.seed` file, then run `npm run seed:production -w server`. The seed preserves existing accounts and skips sample members it already created. Run it from a host that Atlas allows to connect.

## 5. Smoke test after each deploy

- `GET https://<app>/api/health` → `{"status":"ok","db":true}`
- Register a new account → onboarding → Today renders.
- Paste a workout, log a meal, add water → Progress shows them.
- Response headers include `content-security-policy` and `strict-transport-security`.

## 6. Production configuration notes

- `NODE_ENV=production` turns on `Secure` cookies, hides error details, and makes the app refuse to start without `JWT_SECRET` and `MONGODB_URI`.
- `trust proxy` is set so rate limiting sees real client IPs behind Render's proxy.
- Static assets under `/assets` are content-hashed and cached for a year; `index.html` is `no-cache`, so new deploys apply at once.
- Graceful shutdown on `SIGTERM` closes HTTP and MongoDB cleanly during redeploys.
- **Free-tier cold start:** Render free services sleep after 15 minutes idle; the first request takes ~30–50 s.
  Open the app a minute before your demo.


## Alternative: front end on Vercel, API on Render

The recommended set-up is one Render service (above). If the React app must be hosted on Vercel:

- `client/vercel.json` forwards every `/api/...` request to the Render service, so the browser still sees one site. The login cookie stays first-party, and `SameSite=Strict` keeps working.
- In Vercel, use root directory `client`, framework Vite, build command `npm run build`, and output directory `dist`. Vercel uses the npm workspace lockfile at the repository root.
- Confirm that the rewrite in `client/vercel.json` matches the Render service URL. After deployment, check `/api/health` through Vercel and verify that sign-in persists when the page reloads.
- For local development, Vite proxies to `http://127.0.0.1:4000`. If you change the API port, set `FITCOACH_API_TARGET` in `client/.env.local` to the corresponding URL and restart Vite.

## Alternative: Docker

```bash
docker build -t fitcoach .
docker run -p 4000:4000 -e MONGODB_URI=... -e JWT_SECRET=... -e CLIENT_ORIGIN=http://localhost:4000 fitcoach
```

The same image runs on Railway, Fly.io, Azure App Service or AWS App Runner.
