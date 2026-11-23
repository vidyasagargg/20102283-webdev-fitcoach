# Security design

FitCoach stores health data (weight, body measurements, pain reports), which GDPR Article 9 treats as
a special category. Security controls are mapped to the **OWASP Top 10 (2021)** below. Each control
has an automated test in `server/tests/auth.security.test.js` unless noted.

| OWASP risk | Threat in this app | Control | Where |
|---|---|---|---|
| **A01 Broken access control** | User B reads or edits User A's meals by guessing an id (IDOR) | Every query is scoped by `userId` from the session; other users' ids return **404**, not 403, so ids cannot be probed | `routes/ownedResource.js` ✔ tested |
| | Privilege escalation via `role` in the request body | Strict Zod schemas reject unknown keys (mass-assignment); role is set only on the server | `validation/schemas.js` ✔ tested |
| | Non-admin reaches admin routes | `requireRole('admin')`; admin sees counts only | `middleware/auth.js` ✔ tested |
| | CSRF: another site posts to the API with the user's cookie | `SameSite=Strict` cookie **and** a required custom header (`X-Requested-With`), which cross-site forms cannot send without a CORS preflight; CORS allows only configured origins | `middleware/security.js` ✔ tested |
| **A02 Cryptographic failures** | Password database leak | bcrypt with 12 rounds (adaptive, salted); hashes are never returned by the API | `routes/auth.routes.js` ✔ tested |
| | Token theft in transit | HTTPS only (Render TLS); `Secure` cookie in production; HSTS via Helmet | `middleware/auth.js`, Helmet |
| | Forged JWT (`alg: none`) | `jwt.verify` pinned to `HS256`; secret ≥ 32 chars enforced at boot | `config/env.js` ✔ tested |
| **A03 Injection** | NoSQL operator injection `{ "$gt": "" }` in login | Zod types require strings; middleware strips `$`-prefixed and dotted keys; Mongoose `strictQuery` | ✔ tested |
| | Stored XSS through meal names or notes | React escapes all output (no `dangerouslySetInnerHTML`); strict **Content-Security-Policy** (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`) blocks injected scripts | Helmet ✔ tested |
| | SQL injection | Not applicable (no SQL); the equivalent NoSQL risk is covered above | |
| **A04 Insecure design** | Coach advice harmful to health | Safety rules in code, after any AI output: calorie floor, max loss rate, pain → rest and see a doctor | `services/coach/` ✔ tested |
| **A05 Security misconfiguration** | Stack traces leak internals | Central error handler hides messages in production; `x-powered-by` disabled | `middleware/errorHandler.js` ✔ tested |
| | Missing headers | Helmet: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame protection | ✔ tested |
| | Secrets in code | All secrets in environment variables; `.env` git-ignored; `.env.example` documents them; production refuses to boot without `JWT_SECRET` | `config/env.js` |
| **A06 Vulnerable components** | Known CVEs in dependencies | `npm audit --omit=dev --audit-level=high` in CI; Zod and React Router upgraded to patched majors | `.github/workflows/ci.yml` |
| **A07 Identification and authentication failures** | Credential stuffing or brute force | Rate limit of 20 auth attempts per 15 min per IP; password policy (≥10 chars, mixed case, digit) | ✔ tested |
| | User enumeration | Identical error, and bcrypt timing equalised against a dummy hash for unknown emails | ✔ tested |
| | Stolen session | 7-day expiry; "sign out on all devices" and password change bump `tokenVersion`, which revokes every old token | ✔ tested |
| **A08 Software and data integrity failures** | Client submits fake nutrition totals | Totals are always recomputed on the server from items | ✔ tested |
| | Untrusted AI output | AI JSON is schema-validated; any failure falls back to rules | `services/coach/aiCoach.js` |
| **A09 Logging and monitoring failures** | Undetected attacks or outages | HTTP access logs (morgan, combined format), error logging, `/api/health` monitored by Render | |
| **A10 SSRF** | User-controlled URLs fetched by the server | The server only calls two fixed hosts; user text is passed as an encoded query parameter | `services/nutrition/usdaClient.js` |

## Additional controls

- **Input size limits:** JSON body ≤ 100 kB; per-field length limits; arrays capped (e.g. ≤ 40 exercises).
- **Denial of service:** general API rate limit (300 requests/min); outbound timeouts (USDA 4 s, AI 15 s);
  progress range ≤ 2 years.
- **Privacy by design:** the AI provider receives only computed day statistics, never name, email or notes;
  admins cannot read health records; users can export all data and delete their account (GDPR Articles 15, 17, 20).
- **Client storage:** no tokens in `localStorage`, so XSS cannot steal the session.

## Known limitations and future work

- Rate-limit counters are in memory per instance; use a Redis store when scaling out.
- No email verification or password reset by email (would need a mail provider).
- No multi-factor authentication.
