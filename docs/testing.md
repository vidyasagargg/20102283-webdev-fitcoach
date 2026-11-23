# Testing strategy

## Levels

| Level | Tool | Scope | Files |
|---|---|---|---|
| Unit | Vitest | Pure domain logic: workout parser, schedule cycle and skips, meal text and nutrition, USDA mapping and caching, double progression, coach safety rules, iCalendar output | `server/tests/units.test.js` |
| API integration | Vitest + Supertest | Real Express app, full middleware chain, real repositories | `server/tests/api.features.test.js` |
| Security | Vitest + Supertest | Auth, cookies, CSRF, NoSQL injection, mass assignment, IDOR, roles, headers, token revocation | `server/tests/auth.security.test.js` |
| Client unit | Vitest | Date and unit-conversion helpers | `client/src/utils/utils.test.js` |
| End-to-end (manual and scripted) | Playwright + headless Chrome | Login, paste workout → review → save, log meal with nutrition, coach review, weekly review, skip day, water; mobile 390 px and desktop 1360 px | Run during development; screenshots in the report |

**Totals: 59 server tests and 5 client tests, all passing.**

## One suite, two databases

The API tests run against whatever store the harness gets:

- Default: the **in-memory repository**, fast and needing no database (developer laptops).
- In CI: `TEST_MONGODB_URI` points the same suite at a **real MongoDB 7** service container, which proves
  the Mongo repository, schemas and indexes (e.g. the unique `{userId, date}` constraint) behave the same.

This follows from the Repository pattern: the business logic cannot tell the stores apart.

## External services

External APIs are **injected**, so tests use fakes:
- `fakeUsda` returns quinoa data and `null` for everything else, which checks the local → USDA → unknown fallback order.
- The USDA client is tested with a stub `fetch` for caching and for failure (offline → `null`, no crash).
- The AI coach is disabled in tests (`aiCoach: null`); the rule coach is the deterministic baseline.

## Selected test cases

| Requirement | Test |
|---|---|
| FR3 cycle with no end date | Session exists for 2027-06-01; Pull 2 is followed by Active rest |
| FR4 skip shifts the plan | Skip 19 Oct → Legs 1 on 20 Oct, Push 1 on 21 Oct; undo restores |
| FR6 paste notes | Warm-up, assisted, drop sets, `3x12 @ 15kg`, misspelt "pechure curls" → Preacher curl, cardio |
| FR8 nutrition | "2 rotis, 100 g paneer bhurji, 1 bowl dal" > 550 kcal, > 25 g protein |
| FR11 safety | Weekly review never sets calories under the floor; fast loss raises calories |
| FR12 no fixed end date | Progress from Oct 2026 to Jan 2027 includes January weigh-ins |
| NFR1 security | See [security.md](security.md) |

## Running

```bash
npm test                                        # everything
npm test -w server                              # server, in-memory store
TEST_MONGODB_URI=mongodb://localhost:27017/fitcoach_test npm test -w server   # against MongoDB
npm run lint
```

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request: install → lint → server tests
(memory) → server tests (MongoDB) → client tests → production build → `npm audit` (high severity
fails the build). Render deploys `main` only after CI passes ("Wait for CI" setting).
