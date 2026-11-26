# FitCoach: personal training and nutrition tracker

FitCoach is a full-stack web information system that does the daily job of a personal trainer.
It plans each day's session, records workouts, meals, water and body data as they happen,
analyses progress over any period, and gives coaching feedback each day and each week within safe limits.

It is built with the **MERN stack** (MongoDB, Express, React, Node.js) and deployed as a single
cloud web service.

| | |
|---|---|
| **Live app** | `https://<your-service>.onrender.com` *(add after deploying, see [docs/deployment.md](docs/deployment.md))* |
| **Demo logins** | Password `DemoPass123` for all (after `npm run seed -w server`): `demo@fitcoach.app` (Charan, steady progress), `priya@fitcoach.app` (losing too fast, safety rules), `arjun@fitcoach.app` (skips, complete rest, pain report), `admin@fitcoach.app` (admin role) |
| **Module** | B9IS130 Web Development for Information Systems |

## Features

- **Accounts:** register, sign in, sign out on all devices, change password, export data, delete account.
- **Today:** progress rings (workout, calories, protein, water), the day's planned session,
  quick water logging, a body check (weight, sleep, steps, energy, pain flag) and the coach's review.
- **Training cycle:** a repeating 8-day push/pull/legs cycle with no end date. *Skip* a lifting day and the
  plan shifts forward; switch an active-rest day to *complete rest* without shifting anything.
- **Gym:** paste free-form gym notes and the parser converts them (warm-ups, drop sets, `3x12 @ 20kg`,
  assisted sets, cardio, misspelt exercise names). Or log set by set with suggested
  weights (double progression) and a rest timer. Every saved workout can be edited.
- **Meals:** type what you ate ("2 rotis, 100 g paneer bhurji, 1 bowl dal"). Calories, protein, carbs, fat,
  fibre and sugar are estimated from a local Indian-food table and the **USDA FoodData Central API**.
  Every item can be edited before or after saving.
- **Water:** a filling bottle, quick-add buttons, on-pace guidance and an editable log.
- **Progress:** pick any range (4 weeks to all time). It shows a weight trend with a 7-day average, target band and
  projected goal date; calorie and protein charts; lift progress per exercise; tape-measurement
  history (inches and cm, compared with your first entry); weekly reviews; and workout and review history.
- **Coach:** daily and weekly reviews in a fixed format (feedback, fixes, tomorrow's focus, motivation).
  A rule-based engine is always available, and an optional AI coach can be switched on. Safety rules are enforced in code: pain
  means rest and see a doctor, calories never drop below the floor, and weekly loss is capped.
- **Reminders:** an iCalendar (`.ics`) feed of daily reminders for the phone's calendar.
- **Installable:** PWA manifest and icons, so "Add to Home Screen" gives a full-screen app with its own icon.
- **Any date:** every daily screen has a date bar to view or fix past days.

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Front end | React 18, React Router 7, Vite 6, Recharts | Component model, code splitting, fast builds, accessible SVG charts |
| Back end | Node.js 22, Express 4 | JavaScript end to end, mature middleware ecosystem |
| Database | MongoDB (Atlas) with Mongoose 8 | Workouts and meals are naturally nested documents |
| Validation | Zod 4 | One schema gives runtime validation and readable field errors |
| Security | bcrypt, JWT in httpOnly cookies, Helmet (CSP), express-rate-limit | See [docs/security.md](docs/security.md) |
| External APIs | USDA FoodData Central (nutrition), Anthropic Messages API (optional AI coach) | |
| Testing | Vitest, Supertest | 59 server tests, 5 client tests |
| CI/CD | GitHub Actions, then Render (auto-deploy), with MongoDB Atlas | |

## Quick start

Use Node.js 22 to match CI and Render. For persistent local development, run MongoDB locally or connect to MongoDB Atlas.

```bash
git clone https://github.com/<you>/fitcoach.git
cd fitcoach
npm install
cp server/.env.example server/.env      # then edit MONGODB_URI and JWT_SECRET
npm run seed -w server                  # optional: demo account with six weeks of data
npm run dev                             # API on :4000, React on http://localhost:5173
```

**No MongoDB?** Run the whole app with an in-memory store and demo data:

```bash
npm run demo        # builds the client, then serves everything on http://localhost:4000 (Windows and Mac)
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (auto-restart) and Vite dev server together |
| `npm test` | Server and client test suites |
| `npm run lint` | ESLint across the monorepo |
| `npm run build` | Production build of the React client into `client/dist` |
| `npm start` | Production server (serves the API and the built client) |
| `npm run seed -w server` | Create or reset the demo account in MongoDB |

## Project structure

```
fitcoach/
├── client/                    React single-page app
│   ├── public/                manifest + icons (PWA)
│   └── src/
│       ├── api/client.js      fetch wrapper (cookies, CSRF header, errors, timeout)
│       ├── context/           AuthContext, UiContext (selected date, toasts)
│       ├── components/        AppShell, DateBar, ui kit, WorkoutEditor, MealEditor, Charts, ReviewCard
│       ├── pages/             Today, Gym, Meals, Water, Progress, Settings, Auth, Onboarding
│       └── styles/app.css     design tokens, light and dark themes, responsive layout
├── server/
│   ├── src/
│   │   ├── app.js             Express app factory (composition root)
│   │   ├── server.js          entry point: DB connection, graceful shutdown
│   │   ├── config/env.js      validated environment configuration
│   │   ├── middleware/        auth, validation, security, error handling
│   │   ├── models/            Mongoose schemas and indexes
│   │   ├── repositories/      Repository pattern: MongoDB and in-memory implementations
│   │   ├── routes/            REST routers (+ generic owned-resource CRUD factory)
│   │   ├── services/          schedule, workout parser, nutrition, coach, progress, iCal
│   │   └── validation/        Zod request schemas
│   └── tests/                 Vitest + Supertest suites
├── docs/                      requirements, architecture, API, security, testing, deployment
├── .github/workflows/ci.yml   lint, test (memory + MongoDB), build, audit
├── render.yaml                Render blueprint
└── Dockerfile                 container image (portable alternative)
```

## Documentation

- [Requirements and planning](docs/requirements.md): problem, stakeholders, functional and non-functional requirements, feasibility
- [Architecture](docs/architecture.md): layers, design patterns, data model, request flow
- [API reference](docs/api.md): every endpoint
- [Security](docs/security.md): OWASP Top 10 mapping
- [Testing](docs/testing.md): strategy and coverage
- [Deployment](docs/deployment.md): MongoDB Atlas + Render, step by step

## Acknowledgements and academic integrity

- Nutrition data: U.S. Department of Agriculture, FoodData Central; Indian values adapted from the
  *Indian Food Composition Tables* (Longvah et al., 2017).
- Open-source libraries are listed in each `package.json`.
- Generative AI (Anthropic's Claude) was used during development to help scaffold and review code
  and documentation. All code was reviewed, run and tested by the author, who can explain every part of it.
  *(Edit this statement so it accurately describes how you used AI, as the module's academic integrity policy requires.)*
