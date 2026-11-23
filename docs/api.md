# REST API reference

Base path `/api`. JSON in and out. Authenticated routes need the `fc_session` cookie (set by
register or login). Every `POST`, `PUT` and `DELETE` must send the header `X-Requested-With: fitcoach` (CSRF guard).

Errors always have the shape `{ "error": "message", "fields": { "path": "message" } }`.

| Status | Meaning |
|---|---|
| 400 | Validation failed (`fields` explains each problem) |
| 401 | Not signed in or session expired |
| 403 | Missing CSRF header, or role not allowed |
| 404 | Not found, or not yours (ids are not revealed) |
| 409 | Duplicate (e.g. email already registered) |
| 429 | Rate limited |

## Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{name, email, password}` | Password ≥ 10 chars with upper case, lower case and a number. Sets the cookie. |
| POST | `/auth/login` | `{email, password}` | Same error for unknown email and wrong password |
| POST | `/auth/logout` | – | Clears the cookie |
| POST | `/auth/logout-all` | – | Invalidates every session (tokenVersion++) |
| POST | `/auth/change-password` | `{currentPassword, newPassword}` | Signs out other devices |
| GET | `/auth/me` | – | Current user (no hash) |

## Profile
| Method | Path | Notes |
|---|---|---|
| GET | `/profile` | User and profile with defaults merged |
| PUT | `/profile` | `{name?, profile?: {targets, goals, safety, schedule, reminders, …}}`, deep-merged; `null` clears a field |
| DELETE | `/profile` | Deletes the account and all its data |

## Daily log and schedule
| Method | Path | Notes |
|---|---|---|
| GET | `/daily/:date` | Everything for a day: schedule, daily log, meals, nutrition totals, water, workouts, review |
| GET | `/daily?from&to` | Daily logs in a range |
| PUT | `/daily/:date` | Upsert `{weightKg, sleepHours, steps, energy, painFlag, painNote, notes}` |
| PUT | `/daily/:date/status` | `{status: normal \| skipped \| complete_rest}`; skip only lifting days, complete rest only active-rest days |
| GET | `/schedule/:date` | Planned session, exercises with last performance and suggested load, next 10 days |

## Workouts, meals, water, measurements (CRUD)
Each supports `GET /?date=` or `GET /?from=&to=`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`.

| Resource | Extra endpoints | Body essentials |
|---|---|---|
| `/workouts` | `POST /workouts/parse {text, date}` converts notes without saving | `{date, session, exercises:[{name, perSide, sets:[{type, weightKg, reps}]}], cardio:[…]}` |
| `/meals` | `POST /meals/estimate {text}` returns `{items, totals, unknown}` | `{date, time, slot, description, items?}`; items are estimated if omitted, and totals are always recomputed |
| `/water` | – | `{date, time, ml}` |
| `/measurements` | `POST` upserts by date | `{date, waistCm, bellyCm, hipsCm, chestCm, bicepsCm, thighsCm, bodyFatPct}` |

## Coach and progress
| Method | Path | Notes |
|---|---|---|
| POST | `/coach/daily/:date` | Generate and store the day's review |
| POST | `/coach/weekly/:date` | Weekly review for the 7 days ending `date` |
| GET | `/coach/reviews?kind&limit` | Review history, newest first |
| GET | `/progress?from&to` | Weight series (with 7-day average), projection, nutrition per day, averages, counts, streak, lifts, workouts, measurements. Range ≤ 2 years. |

## Export and admin
| Method | Path | Notes |
|---|---|---|
| GET | `/export/data.json` | All of the user's data |
| GET | `/export/reminders.ics?tz&days&start` | iCalendar reminders (RFC 5545) |
| GET | `/admin/stats` | Admin role only: document counts, no personal data |
| GET | `/health` | Liveness and database status (used by Render) |

## Example

```http
POST /api/meals/estimate
Content-Type: application/json
X-Requested-With: fitcoach

{ "text": "2 rotis, 100 g paneer bhurji, 1 bowl dal" }
```
```json
{
  "items": [
    { "name": "rotis", "qty": 2, "grams": 80, "source": "local", "kcal": 237.6, "protein": 7.8, "carbs": 43.2, "fat": 3.5, "fibre": 7.8, "sugar": 1.2 },
    { "name": "paneer bhurji", "qty": 100, "unit": "g", "grams": 100, "source": "local", "kcal": 230, "protein": 14, "carbs": 6, "fat": 17, "fibre": 1.2, "sugar": 2.8 },
    { "name": "dal", "qty": 1, "unit": "bowl", "grams": 150, "source": "local", "kcal": 174, "protein": 10.2, "carbs": 24, "fat": 4.5, "fibre": 5.3, "sugar": 1.5 }
  ],
  "totals": { "kcal": 641.6, "protein": 32, "carbs": 73.2, "fat": 25, "fibre": 14.3, "sugar": 5.5 },
  "unknown": []
}
```
