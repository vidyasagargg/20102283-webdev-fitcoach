# Requirements analysis and planning

## 1. Problem domain

People trying to lose fat while building muscle usually fail on **consistency and feedback**, not
knowledge. A human personal trainer fixes this by planning each session, checking food and recovery,
noticing missed targets, adjusting the plan weekly, and keeping the client motivated. That costs
money, and it is limited to the hours the trainer is present.

Generic fitness apps split this job across separate tools: one for workouts, one for calories, one for
water. None of them reasons across all of it. They also handle **Indian vegetarian diets** badly
(roti, dal, paneer bhurji), and they make logging slow, because a gym-goer who already types notes
on their phone between sets has to re-enter every set by hand.

FitCoach is an information system that captures this data with very little effort and turns it into
coaching decisions.

## 2. Stakeholders and users

| Stakeholder | Interest | How the system serves them |
|---|---|---|
| **Primary user (trainee)** | Log quickly, know what to do today, see progress, stay motivated | Today screen, paste-to-log, auto nutrition, reviews, charts |
| **Personal trainer / coach** (future role) | Monitor adherence, adjust plans | Structured data, weekly review, data export |
| **Administrator** | Keep the service healthy | Admin stats endpoint (counts only, no health data), health check |
| **Healthcare professional** (indirect) | Client safety | Pain/dizziness flag → mandatory "rest and see a doctor"; calorie floor |
| **Module assessor** | Evidence of full-stack, secure, tested, deployed engineering | Repository, docs, CI, live deployment |

**Persona: Charan, 27.** Works 2–10 PM, trains in the morning, vegetarian (no bread, no brinjal),
72.35 kg and 28.2% body fat at the start, goal 16–18% body fat. Uses an iPhone and types
workout notes into the Notes app at the gym.

## 3. Research and existing solutions

| Product | Strengths | Gaps addressed by FitCoach |
|---|---|---|
| MyFitnessPal | Huge food database | Weak on Indian home food; no training plan or coaching |
| Strong / Hevy | Excellent set logging | No nutrition; logging is manual, set by set |
| HealthifyMe | Indian foods, coaching (paid) | Training logging is shallow; coaching costs money |
| Apple Fitness | Steps and activity | No strength or nutrition coaching |

Approaches from the literature and practice that the design uses:
- **Double progression** for hypertrophy training (stay at a load until the top of the rep range is
  reached on every set, then add load).
- **Rate of loss of 0.5–1% body weight per week** to keep lean mass, which gives the
  `maxWeeklyLossKg` limit and the weekly calorie adjustments.
- **Weekly averages, not single weigh-ins**: the 7-day rolling average smooths water-weight noise.
- **Low-friction logging** (paste notes, type meals in natural language) to improve adherence.

## 4. Functional requirements (MoSCoW)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR1 | Users can register, sign in, sign out, change password, sign out on all devices | Must | Done |
| FR2 | Users can only access their own data | Must | Done |
| FR3 | The system shows the planned session for any date from a repeating cycle with no end date | Must | Done |
| FR4 | A lifting day can be skipped, which shifts the rest of the plan; an active-rest day can become complete rest | Must | Done |
| FR5 | Users can log workouts set by set (type, weight, reps) with cardio | Must | Done |
| FR6 | Users can paste free-form notes that are converted into structured workouts and reviewed before saving | Must | Done |
| FR7 | Workouts, meals, water and measurements can be created, read, updated and deleted | Must | Done |
| FR8 | Meals described in free text get estimated calories, protein, carbs, fat, fibre and sugar | Must | Done |
| FR9 | Daily body check: weight, sleep, steps, energy, pain flag | Must | Done |
| FR10 | Daily coach review: feedback, fixes, tomorrow's session and focus, motivation | Must | Done |
| FR11 | Weekly review adjusts targets within safety limits | Must | Done |
| FR12 | Progress analytics over any date range (weight trend, nutrition, lifts, measurements) | Must | Done |
| FR13 | Users can view and edit any past day | Should | Done |
| FR14 | Suggested loads for the next session (double progression) | Should | Done |
| FR15 | Reminders exported to the phone calendar (.ics) | Should | Done |
| FR16 | Data export (JSON) and account deletion | Should | Done |
| FR17 | Optional AI-generated coaching | Could | Done (optional, off by default) |
| FR18 | Trainer role that views assigned clients | Could | Future work |
| FR19 | Automatic Apple Health step sync | Won't (this release) | Clipboard shortcut instead (no web API exists) |

## 5. Non-functional requirements

| ID | Category | Requirement | How it is met |
|---|---|---|---|
| NFR1 | Security | OWASP Top 10 controls; passwords never stored in plain text | bcrypt, httpOnly JWT, CSP, validation, rate limits ([security.md](security.md)) |
| NFR2 | Privacy | Health data visible only to its owner; export and erasure available | Ownership-scoped queries; `/export/data.json`; `DELETE /profile` |
| NFR3 | Usability | Logging a meal or water takes under 10 seconds on a phone | One-tap water; type-a-sentence meals; paste-to-log |
| NFR4 | Accessibility | WCAG 2.2 AA intent | Labels, focus styles, skip link, ARIA live toasts, chart table views, 44 px targets |
| NFR5 | Responsiveness | Works from 360 px phones to desktop | Mobile-first CSS; tab bar on phones, sidebar on desktop |
| NFR6 | Performance | First screen interactive in under 3 s on 4G | Code-split pages, system fonts, gzip, immutable asset caching |
| NFR7 | Reliability | External API failure never breaks logging | Timeouts, cache, local fallback, AI → rules fallback |
| NFR8 | Maintainability | Modular, tested, linted | Layered architecture, design patterns, 64 tests, ESLint, CI |
| NFR9 | Scalability | Stateless app tier | JWT sessions, indexed queries, horizontal scaling behind a load balancer |
| NFR10 | Portability | Deployable on any Node host | 12-factor config, Dockerfile, Render blueprint |

## 6. Feasibility

- **Technical:** all components are mature, free and well-documented. The riskiest feature, the
  free-text workout parser, was prototyped first against real notes and covered with unit tests.
- **Economic:** MongoDB Atlas M0, Render free tier, USDA API (free key) and GitHub Actions cost £0.
  The AI coach is optional, so the system has no running cost.
- **Operational:** a single deployable unit (API + static client) with a health check and auto-deploy.
- **Legal and ethical:** health data is sensitive personal data under GDPR. The design minimises data,
  supports export and erasure, never sends identity to the AI provider, and gives no medical advice
  (pain → see a doctor).
- **Constraints found:** iOS gives web apps no Apple Health access and limited web push. These are
  mitigated with a Shortcuts clipboard flow and calendar (.ics) reminders.

## 7. Plan

| Phase | Output |
|---|---|
| 1. Discovery | Persona, prototype (single-page tool), requirements |
| 2. Architecture | Data model, API design, security design |
| 3. Back end | Auth, CRUD, services, tests |
| 4. Front end | Pages, components, accessibility, responsive layout |
| 5. Integration | USDA API, optional AI coach, iCal export |
| 6. Quality | Test suites, CI pipeline, dependency audit |
| 7. Deployment | Atlas + Render, environment configuration, smoke test |
| 8. Evaluation | Report, presentation, demo data |

**Risks:** USDA rate limits (mitigated by cache and the local table), free-tier cold starts (documented;
health check), parser edge cases (editable preview plus a list of unparsed lines).
