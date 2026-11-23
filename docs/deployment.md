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
2. **Database Access** → *Add New Database User* → username `fitcoach`, a generated password, role *Read and write to any database*.
3. **Network Access** → *Add IP Address* → `0.0.0.0/0` (Render free instances have no fixed IP; access is still protected by TLS and the password).
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
| `ADMIN_EMAILS` | optional: your email, to get the admin role when you register |

4. Deploy. When the log shows `Connected to MongoDB` and `listening`, open the URL.
5. **Settings → Build & Deploy → Auto-Deploy: "After CI checks pass"** so only tested commits go live.

## 4. Seed the demo account (optional, for the presentation)

From your machine, with `MONGODB_URI` pointing at Atlas:

```bash
MONGODB_URI="mongodb+srv://..." npm run seed -w server
```

Then sign in with `demo@fitcoach.app`, `priya@fitcoach.app`, `arjun@fitcoach.app` or `admin@fitcoach.app`, all with password `DemoPass123`.

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

## Alternative: Docker

```bash
docker build -t fitcoach .
docker run -p 4000:4000 -e MONGODB_URI=... -e JWT_SECRET=... -e CLIENT_ORIGIN=http://localhost:4000 fitcoach
```

The same image runs on Railway, Fly.io, Azure App Service or AWS App Runner.
