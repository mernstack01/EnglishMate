# EnglishMate

A personal English / IELTS learning space. Phase 1 provides authentication, private-user architecture, administration, responsive layouts, settings, and a dashboard. Learning modules are deliberately not implemented. Dashboard statistics are explicitly labeled previews, with unavailable values displayed as dashes.

## Requirements

- Node.js 22.12+ (tested with Node 24)
- pnpm 12.6 (`npm install -g pnpm@12.6.0`)
- MongoDB 7+ locally, or a MongoDB Atlas database

Next.js 16.3.6 uses the App Router, React, strict TypeScript, Tailwind CSS 4, shadcn/ui-style local components (Radix Slot, CVA, and `components.json`), Mongoose, Zod, and Auth.js. Auth.js v5 is currently published as `next-auth@5.0.0-beta.32`; the exact version is pinned. TypeScript 5.9 is used for compatibility with the ESLint parser. The lockfile pins the complete dependency tree. Development and production builds use Next.js’s supported Webpack mode so they also work in environments that restrict Turbopack worker ports.

## Installation and development

```sh
pnpm install
cp .env.example .env.local
# Edit .env.local with your MongoDB connection and admin details.
# Generate AUTH_SECRET with: openssl rand -base64 32
pnpm seed:admin
pnpm dev
```

Open http://localhost:3000. Register a learner at `/register`, or sign in with the admin credentials you configured. Admin seed creates required indexes before creating an account. If you do not want an admin yet, run `pnpm db:indexes` instead before accepting registrations.

### MongoDB configuration

For a local MongoDB instance, use `mongodb://127.0.0.1:27017/englishmate`. For Atlas, create a database user, allow your application server's network address, and use the supplied `mongodb+srv://` connection string with an explicit database name. Percent-encode special characters in credentials. Never commit `.env.local`.

The connection helper caches one pool per Node process and survives development hot reloads. A failed initial connection clears the cache to allow retry. Production does not automatically create indexes: run `pnpm db:indexes` (or the initial seed) against the target database as a deployment step.

### Environment

| Variable          | Purpose                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `MONGODB_URI`     | Required database connection string                                                       |
| `AUTH_SECRET`     | Required high-entropy Auth.js signing/encryption secret                                   |
| `AUTH_URL`        | Application origin; `http://localhost:3000` locally, HTTPS in production                  |
| `ADMIN_EMAIL`     | Email used by the admin seed only                                                         |
| `ADMIN_PASSWORD`  | Seed password, at least 12 characters and at most 72 UTF-8 bytes                          |
| `ADMIN_NAME`      | Display name used by the admin seed                                                       |
| `AUTH_TRUST_HOST` | Optional; set `true` only when deployed behind a trusted proxy that controls host headers |
| `AI_PROVIDER`     | Active AI provider: `gemini`, `openai`, or `mock` (defaults to `mock` in test runners)    |
| `GEMINI_API_KEY`  | Google Gemini API key (server-side only)                                                  |
| `GEMINI_MODEL`    | Gemini model for vision and enrichment (default: `gemini-2.5-flash`)                      |
| `OPENAI_API_KEY`  | OpenAI API key (server-side only)                                                         |

### AI Provider Configuration

EnglishMate supports three AI providers for textbook image vocabulary extraction, enrichment, and manual autofill:

- `gemini`: Uses Google Gemini Developer API (via the official `@google/genai` SDK).
- `openai`: Uses OpenAI API (via official `openai` SDK).
- `mock`: Deterministic mock provider for local development without API keys and automated testing.

#### Setting up Google Gemini

1. **Obtain an API key from Google AI Studio:**
   - Visit [Google AI Studio](https://aistudio.google.com/).
   - Sign in with your Google account.
   - Click **Get API key** and create an API key in a Google Cloud project.
2. **Configure your environment:**
   Add the following to `.env.local`:
   ```sh
   AI_PROVIDER=gemini
   GEMINI_API_KEY=AIzaSyYourActualKeyHere
   GEMINI_MODEL=gemini-2.5-flash
   ```
   > **Consumer Gemini Subscriptions vs. Gemini Developer API:**
   > A consumer subscription (such as Google One AI Premium or Gemini Advanced at `gemini.google.com`) is for the consumer web chat interface and does **not** grant or include Developer API access.
   > The Developer API utilized by EnglishMate is provided through [Google AI Studio](https://aistudio.google.com/) or Google Cloud Vertex AI. Google AI Studio provides a free tier with rate limits, as well as pay-as-you-go billing.

#### Missing API Key Handling

If `AI_PROVIDER=gemini` is selected but `GEMINI_API_KEY` is not set:

- The application does not crash.
- A friendly configuration warning is displayed in the Image Import Wizard and single-word AI autofill dialogs.
- Regular Vocabulary notebook, spaced repetition learning, and practice modules continue functioning normally.

#### Live Smoke Test

Automated test suites (`pnpm test`, `pnpm test:e2e`, `pnpm build`) always use the `MockAiProvider` and make **zero live API calls**.

To manually test live Gemini extraction and enrichment with an actual textbook image:

```sh
pnpm smoke:gemini -- /path/to/textbook-page.jpg
```

If `GEMINI_API_KEY` is unset, the script exits immediately with an instructional notice and zero cost.

### Admin creation

```sh
pnpm seed:admin
```

The seed loads `.env.local`, validates inputs, creates indexes, hashes the password, and creates an active ADMIN. It is safe to rerun: an existing admin's password and account status remain unchanged. It refuses to silently promote a regular account with the same email. No credentials are hardcoded or printed. Remove seed credentials from the runtime environment when no longer needed.

## Build and production

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:indexes
pnpm start
```

A build does not need a live database or actual secrets. Runtime authenticated requests do. Configure the production environment, HTTPS, and indexes before opening traffic. Deploy as one Node.js application; MongoDB services and Auth.js use the Node runtime. No separate backend is required.

## Project structure

```text
src/
  app/
    (auth)/             Login and registration
    (dashboard)/        Protected learner pages and settings
    admin/              Protected admin overview and users
    api/auth/           Auth.js handlers
    actions.ts          Validated server-action entry points
  components/
    ui/                 Local shadcn/ui primitives
    forms/              Interactive form presentation
    layout/             Sidebar, mobile navigation, app shell
  features/
    vocabulary/         Reserved feature boundary
    synonyms/           Reserved feature boundary
    grammar/            Reserved feature boundary
    learning/           Module catalog and empty state
    progress/           Explicit Phase 1 placeholder statistics
  lib/
    auth/               Session, identity, password and rate-limit utilities
    db/                 Cached MongoDB connection and ownership helpers
    ai/                 Future server-only provider boundary
    storage/            Future server-only storage boundary
  models/               User and RateLimit schemas
  services/             User/admin business logic and database access
  validations/          Shared Zod input schemas
  types/                DTOs, action results and session augmentation
scripts/                Admin seed, indexes, isolated integration checks
tests/                  Security validation and password checks
```

UI invokes server actions; business operations live in services. Services authorize independently of layouts, so calling an action directly does not bypass access control. There are no standalone admin REST endpoints: admin mutations use protected Server Actions, with Next.js origin checks. Auth.js owns `/api/auth/*` and its CSRF-protected credentials and logout endpoints.

## Models and indexes

**User:** `_id`, `name`, normalized `email`, `passwordHash`, `role` (`USER` / `ADMIN`), `isActive`, `preferredLanguage` (`UZ` / `EN`), timestamps. Unique email index enforces uniqueness even during simultaneous registration. Compound indexes support date pagination and active-status queries. Password hashes are excluded from normal queries and JSON serialization; client-facing users are explicit DTOs.

**RateLimit:** hashed window key, count, expiration. An atomic MongoDB counter shares limits across app instances; a TTL index cleans up expired windows. Login is limited per normalized account email (10 attempts / 15 minutes); registration is limited per email (5 / 15 minutes) and globally (100 / 15 minutes). These conservative Phase 1 limits may be tuned for expected traffic. Failed authentication uses a generic message and performs password work for nonexistent users. Rate-limit failures fail closed. Public production deployments can additionally enforce source-based limits at their trusted ingress without trusting arbitrary forwarded-IP headers in this app.

## Authentication and ownership

1. Registration validates name, normalized email, and password; client role and status are ignored. Passwords use bcrypt with cost 12. UTF-8 byte limits prevent silent bcrypt truncation.
2. Auth.js Credentials verifies the hash and active status, and issues an encrypted, HTTP-only JWT session lasting seven days. Cookies are secure on HTTPS.
3. Session callbacks and protected services re-read the database. Deactivation blocks existing sessions on their next request; role changes are not trusted from the browser or JWT.
4. Logout clears the Auth.js session cookie. Settings can only update the session user's name and preferred learning language. The interface currently remains English. Password changes are deferred.
5. Admin pages and services require a current database ADMIN role. Self-deactivation is rejected server-side and unavailable in the UI.

Future learning schemas must include immutable `userId` and compound indexes starting with `userId`. Use `ownedScope()` / `ownedDocumentScope(id)` for every read, update and delete; they obtain identity from the server session, never from a browser-provided user ID. Create with validated fields plus server-derived ownership. See `src/features/README.md`. Admin membership does not grant access to other users' private learning records. No learning data models exist in Phase 1.

All inputs are validated; search escapes regex metacharacters; IDs are checked before database queries. Only allowed fields are written. Secrets remain server-side, internal failures do not expose database details in UI, and headers disable framing and MIME sniffing.

## Routes

| Route                                                                      | Access / behavior                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/`                                                                        | Redirects to dashboard; unauthenticated users continue to login                       |
| `/login`, `/register`                                                      | Public account forms                                                                  |
| `/dashboard`                                                               | Real user identity, isolated placeholder learning stats                               |
| `/learn`, `/vocabulary`, `/synonyms`, `/grammar`, `/mistakes`, `/progress` | Protected, polished upcoming-feature states                                           |
| `/settings`                                                                | Protected profile, language, theme, logout                                            |
| `/admin`                                                                   | ADMIN only; total, active, new-in-last-30-days counts                                 |
| `/admin/users`                                                             | ADMIN only; literal name/email search, pagination, active filter, activate/deactivate |
| `/api/auth/*`                                                              | Auth.js session, sign-in and sign-out endpoints                                       |

Desktop has a full sidebar. Mobile has Home, Learn, Vocabulary, Grammar, and Profile bottom navigation; other modules are accessible through dashboard cards. Admin is available from the administrator's Profile page. Theme defaults to the system preference and persists in local storage; reduced-motion preferences are respected.

## Integration verification

```sh
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
# Alternatively, use an installed Google Chrome:
PLAYWRIGHT_CHROME=1 pnpm test:e2e
```

The integration script downloads a test-only MongoDB binary on its first run, starts a disposable database, launches the production app on port 3107, and exercises real browser flows. It does not use or alter `.env.local` or your configured database. It checks registration, uniqueness, login, safe sessions, route protection, settings, themes, mobile layout, all empty pages, admin search/pagination/filtering, deactivation of an existing session, reactivation, and logout. Screenshots go to ignored `test-results/`. The browser and database are shut down afterward. Tests need permission to start local servers.

Phase 2 vocabulary and spaced repetition are intentionally outside this release.

# EnglishMate
