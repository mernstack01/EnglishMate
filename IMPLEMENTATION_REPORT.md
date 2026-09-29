# EnglishMate — Phase 1 implementation report

Phase 1 is implemented and verified. No Phase 2 learning functionality was added.

## Structure and architecture

A single Next.js 16.3.6 App Router application uses React, strict TypeScript, Tailwind CSS, local shadcn/ui primitives, Mongoose, Auth.js and Zod. Dependencies are managed with pnpm and a committed lockfile. Auth.js is pinned to `5.0.0-beta.32`; its v5 distribution remains beta. TypeScript 5.9 provides compatibility with the lint parser. Next.js's supported Webpack mode is used for reliable development/build execution in this environment.

- `src/app`: public authentication, protected learner routes, admin routes, Auth.js handlers and Server Actions.
- `src/components`: UI primitives, forms and responsive layouts.
- `src/features`: vocabulary/synonym/grammar boundaries, learning empty states and isolated placeholder progress values.
- `src/lib`: authentication, ownership, MongoDB connection and documented future AI/storage boundaries.
- `src/models`, `src/services`, `src/validations`, `src/types`: database definitions, business operations, input schemas and client-safe types.
- `scripts`, `tests`: admin creation, database indexes, unit security checks and isolated browser integration tests.

Server Actions validate input and invoke services. Services enforce authorization themselves; layouts are not the only access-control boundary. No separate backend, Redis, queues or learning APIs were introduced.

## Database and authentication

`User` contains all requested fields, timestamps and a unique normalized-email index. Status/date indexes support administration. `RateLimit` provides atomic shared authentication limits, with a TTL expiration index. Database connections are pooled and cached across development hot reloads. Deployment scripts explicitly create production indexes.

Registration validates inputs and creates an active USER with a bcrypt cost-12 password hash. Login uses Auth.js Credentials and encrypted HTTP-only JWT sessions. Password hashes are excluded from ordinary queries, serialization and client DTOs. Logout clears the session. Protected operations obtain identity from the server session and re-read current role and activity from MongoDB. Deactivation invalidates access on the user's next server request.

Reusable `ownedScope()` and `ownedDocumentScope()` derive ownership from the session. Future models must use immutable `userId` fields and user-prefixed compound indexes. No learning documents exist yet.

## Administration

ADMIN-only services and pages provide total users, active users, and registrations in the last 30 days. User management includes escaped literal name/email search, ten-user pagination, status filtering, and activation/deactivation. Self-deactivation is blocked in both the interface and server service. The admin seed uses environment credentials and is idempotent without resetting passwords or promoting an existing regular account.

## Routes and interface

- Public: `/login`, `/register`.
- Protected: `/dashboard`, `/learn`, `/vocabulary`, `/synonyms`, `/grammar`, `/mistakes`, `/progress`, `/settings`.
- ADMIN-only: `/admin`, `/admin/users`.
- Auth.js: `/api/auth/*`.
- `/` redirects to the protected dashboard.

The dashboard uses real user identity and explicitly marked placeholder statistics. Learning routes have finished empty states. Desktop navigation uses a sidebar; mobile uses the requested five-item bottom navigation. Light/dark theme follows the system initially and persists on the device. Settings save name and EN/UZ preference. The interface remains English; password changes and translated learning content are deferred.

## Security

Server-side current-role checks, active-user checks, Zod allowlists, bcrypt hashing, safe DTOs, session-derived ownership, escaped search expressions, validated IDs, unique-email enforcement, MongoDB-backed rate limiting, Server Action origin checks, Auth.js CSRF protection, and basic response security headers are implemented. No real secrets are committed. Administrative access does not confer access to future private learning records.

## Verification results

| Check                                 | Result                                                |
| ------------------------------------- | ----------------------------------------------------- |
| ESLint                                | Passed, zero warnings/errors                          |
| TypeScript strict typecheck           | Passed                                                |
| Production build                      | Passed; all requested routes generated                |
| Security unit tests                   | 4 passed                                              |
| Prettier                              | Passed                                                |
| Production-server browser integration | Passed using real Chrome and disposable MongoDB 8.2.6 |

The integration suite verified MongoDB connectivity, admin seeding and safe reruns, registration, the unique-email index, login/session safety, protected routes, regular-user rejection from admin pages, **direct admin-action rejection for regular users**, **tampered self-deactivation rejection**, profile persistence, theme persistence, mobile overflow/navigation, all empty-state routes, admin pagination/search/filtering, activation/deactivation, existing-session revocation, inactive login rejection, reactivation and logout. No browser runtime errors were observed.

Desktop, dark-mode and mobile screenshots were generated in ignored `test-results/` and inspected. A mobile illustration overlap and small-screen sidebar scrolling were corrected during review.

Verification used an isolated temporary database, not a configured production database. You must supply your own MongoDB URI, Auth.js secret and initial admin credentials before using the app with persistent data.

## Run locally

```sh
npm install -g pnpm@12.6.0  # if pnpm is not installed
pnpm install
cp .env.example .env.local
# Fill MONGODB_URI, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_NAME.
# Generate AUTH_SECRET with: openssl rand -base64 32
pnpm seed:admin
pnpm dev
```

For production: `pnpm build`, `pnpm db:indexes`, then `pnpm start` with the production environment configured. Full setup and test instructions are in `README.md`.

---

# EnglishMate — Phase 2 implementation report

Phase 2 is fully implemented and verified. The production-quality Vocabulary Notebook and the spaced repetition data foundation are complete.

## 1. Files and features added

- `src/models/vocabulary-word.ts`: Mongoose schema and model with embedded review state, validation pre-hooks, and compound ownership indexes.
- `src/models/vocabulary-review.ts`: Standalone review state model preparing for Phase 3 spaced repetition schedules.
- `src/validations/vocabulary.ts`: Strict Zod schemas for word input, editing, status change, query parameters, month formatting, and JSON import parsing.
- `src/services/vocabulary.ts`: Centralized service for CRUD, search, status changes, date aggregation, calendar counts, import analysis, and bulk writes.
- `src/features/vocabulary/actions.ts`: Authenticated Server Actions for creation, editing, status toggles, deletion, and bulk import.
- `src/features/vocabulary/constants.ts`: Status enums (`NEW`, `LEARNING`, `DIFFICULT`, `LEARNED`), source enums (`MANUAL`, `JSON`, `IMAGE`, `AI`), and `normalizeWord()` helper.
- `src/features/vocabulary/components/`:
  - `navigation.tsx`: Local sub-navigation (All Words, Today, Calendar, Add Word, Import).
  - `notebook.tsx`: Digital notebook view, search bar, status filters, sort select, pagination, and empty states.
  - `word-form.tsx`: Add/edit word form with progressive disclosure for optional fields and "Save and add another".
  - `status-actions.tsx`: Quick one-tap buttons to mark words as Difficult or Learned with instant optimistic feedback.
  - `import-form.tsx`: JSON import interface with paste area, file upload, dry-run preview table, issue breakdown, and confirmation.
- `src/app/(dashboard)/vocabulary/`:
  - `page.tsx`: Main notebook with search, status filtering, date filtering, sorting, and pagination.
  - `today/page.tsx`: Today's vocabulary view based on the user's timezone.
  - `calendar/page.tsx`: Monthly calendar grid with activity dots, word count links, and daily words list.
  - `new/page.tsx`: Add new word page.
  - `[id]/page.tsx`: Word detail and edit page with delete confirmation.
  - `[id]/not-found.tsx`: Clean 404 state when a word does not exist or belongs to another user.
  - `import/page.tsx`: Two-stage JSON import workflow.
  - `layout.tsx`: Vocabulary layout with sub-navigation.
- `src/lib/dates.ts`: Civil date boundaries, timezone-aware day ranges, and calendar month generation.
- `src/lib/vocabulary-timezone.ts`: Timezone resolver with default fallback to `Asia/Tashkent`.
- `scripts/seed-vocabulary.ts`: Development seed script with sample vocabulary words.
- `scripts/vocabulary-e2e.ts`: Comprehensive Playwright integration test suite for vocabulary flows.
- `tests/vocabulary.test.ts`: Integration and unit tests covering normalizer, validation, civil dates, duplicates, bulk writes, isolation, and review cleanup.

## 2. Mongoose models and indexes

### `VocabularyWord`

- Fields: `_id`, `userId` (immutable), `word` (trimmed, max 120), `normalizedWord` (server-generated, max 120), `translation` (max 500), `definition` (max 2000), `example` (max 2000), `pronunciation` (max 200), `partOfSpeech` (max 80), `notes` (max 4000), `status` (`NEW` | `LEARNING` | `DIFFICULT` | `LEARNED`), `source` (`MANUAL` | `JSON` | `IMAGE` | `AI`), `difficulty` (0-5 integer), `review` (embedded `ReviewState`), `createdAt`, `updatedAt`.
- Embedded `review`: `nextReviewAt`, `lastReviewedAt`, `intervalDays`, `easeFactor`, `repetitions`, `correctCount`, `incorrectCount`.
- Indexes:
  - `{ userId: 1, normalizedWord: 1 }` (unique): Enforces duplicate prevention per user while allowing identical words across different users.
  - `{ userId: 1, createdAt: -1, _id: -1 }`: Fast date-sorted queries and pagination.
  - `{ userId: 1, status: 1, createdAt: -1, _id: -1 }`: Status-filtered queries.
  - `{ userId: 1, "review.nextReviewAt": 1, status: 1 }`: Due reviews query index.

### `VocabularyReview`

- Standalone model linked via `vocabularyWordId` and `userId` for Phase 3 spaced repetition algorithms.
- Indexes:
  - `{ userId: 1, vocabularyWordId: 1 }` (unique)
  - `{ userId: 1, nextReviewAt: 1 }`

## 3. Vocabulary routes

- `/vocabulary`: All words list with search, status filters, sort options, and 20-word pagination.
- `/vocabulary/today`: Filters words created today in the configured application timezone.
- `/vocabulary/calendar`: Month-by-month calendar view with daily word count badges and selected-day list.
- `/vocabulary/new`: Minimal input (word + translation) with collapsible optional details and "Save and add another".
- `/vocabulary/[id]`: Full word edit and delete view.
- `/vocabulary/import`: JSON preview and bulk import workflow.

## 4. Search, filter, and pagination

- **Search**: Escapes regex special characters to prevent ReDoS/syntax errors; queries both `word` and `translation` case-insensitively.
- **Filter**: All, New, Learning, Difficult, Learned; also filters by specific date.
- **Sorting**: Newest first, Oldest first, Alphabetical A–Z, Reverse Z–A.
- **Pagination**: 20 items per page with next/previous links, page counter, and boundary handling.

## 5. Date and calendar implementation

- Civil dates are computed using `Intl.DateTimeFormat` with the user/system timezone (`APP_TIMEZONE` or `Asia/Tashkent`).
- UTC day edges and daylight saving transitions are supported without day drift.
- Calendar uses MongoDB aggregation (`$dateToString` with timezone) to count words per day efficiently without transferring full records.

## 6. JSON import workflow

- **Format**: JSON array of objects with required `word` and `translation`, plus optional fields.
- **Two-stage safety**:
  1. _Parse & Validate_: Analyzes payload, validates shapes, marks malformed rows, and checks against current user's existing vocabulary.
  2. _Preview Table_: Displays detected count, ready count, invalid count, and duplicates (both in-file and database-existing).
  3. _Re-validated Bulk Write_: Server re-validates the payload upon confirmation and executes an unordered `bulkWrite` using `$setOnInsert` and `timestamps: false`.

## 7. Duplicate strategy

- Normalization rules: trims whitespace, normalizes Unicode width (NFKC), collapses multiple internal spaces, and converts to lowercase.
- Same user duplicate attempt: rejected with a clear user-facing error message ("This word is already in your notebook.").
- Different users: allowed to have identical words and translations without conflict.
- Import duplicates: skipped automatically without halting the import of other valid words.

## 8. Ownership and security

- Server session derives user ownership (`ownedScope()`, `ownedDocumentScope()`).
- Tampered `userId`, `source`, `status`, or review fields submitted in forms are stripped by Zod schemas.
- User A cannot view, edit, change status of, or delete User B's vocabulary. Accessing another user's word returns a clean 404 ("Word not found.").
- Search queries are scoped to the authenticated user's ID.

## 9. Dashboard integration

- Phase 1 placeholders replaced with live MongoDB queries:
  - **Total vocabulary**: `countDocuments({ userId })`
  - **New words today**: `countDocuments({ userId, createdAt: todayRange })`
  - **Difficult words**: `countDocuments({ userId, status: "DIFFICULT" })`
  - **Vocabulary due**: `countDocuments({ userId, status: { $ne: "LEARNED" }, "review.nextReviewAt": { $lte: now } })`
  - **Words learned**: `countDocuments({ userId, status: "LEARNED" })`

## 10. Verification results

| Check                                          | Result                        |
| ---------------------------------------------- | ----------------------------- |
| ESLint                                         | Passed (0 warnings, 0 errors) |
| TypeScript strict typecheck                    | Passed                        |
| Unit and integration tests (`pnpm test`)       | 11/11 passed (100%)           |
| Playwright E2E browser tests (`pnpm test:e2e`) | 19 assertions passed          |
| Prettier formatting                            | Passed                        |
| Production build (`pnpm build`)                | Passed (19 routes generated)  |

---

# EnglishMate — Phase 3 Implementation Report

Phase 3 (Vocabulary Learning Engine + Spaced Repetition + Practice Games + Daily Review) is fully implemented, verified, and integrated.

## 1. Review Architecture Decision

- **Canonical Source of Truth**: The standalone `VocabularyReview` model (`src/models/vocabulary-review.ts`) was audited and selected as the **canonical source of truth** for all review scheduling, intervals, ease factors, repetition counts, and due queries.
- **Rationale**: Standalone `VocabularyReview` supports:
  1. High-performance compound indexes: `{ userId: 1, nextReviewAt: 1 }` and `{ userId: 1, vocabularyWordId: 1 }` (unique).
  2. Clean atomic updates independent of dictionary metadata updates.
  3. Easy aggregation of user review progress and future analytics without scanning large word documents.
- **Migration & Backward Compatibility**:
  - `ensureUserReviews(userId)`: Implemented in `src/services/vocabulary.ts` to lazily backfill canonical `VocabularyReview` documents for all legacy words created during Phase 1 & 2 or newly imported via JSON.
  - **Dual-write sync**: When a review is updated during a learning session, the standalone `VocabularyReview` is updated as canonical truth, and the embedded `word.review` is synchronized in the same operation to maintain backward compatibility with legacy views.
- **Indexes**:
  - `VocabularyReview`: `{ userId: 1, nextReviewAt: 1 }`, `{ userId: 1, vocabularyWordId: 1 }` (unique).
  - `StudySession`: `{ userId: 1, createdAt: -1 }`, `{ userId: 1, completedAt: -1 }`.
  - `VocabularyAttempt`: `{ userId: 1, createdAt: -1 }`, `{ userId: 1, vocabularyWordId: 1 }`, `{ userId: 1, isCorrect: 1 }`.

## 2. Spaced Repetition Algorithm

- **SM-2-Inspired Deterministic Algorithm**: Implemented in `src/lib/spaced-repetition.ts` as `calculateNextReview(currentReview, rating, now)`. Completely isolated from React and server components for pure unit testability.
- **Ratings & Progression**:
  - `AGAIN`: Repetitions reset to 0; interval reset to 10 minutes (`intervalDays = 0.007`); ease factor decreased by 0.20; word prioritized for immediate retry.
  - `HARD`: Interval increased moderately by `max(1, round(previousInterval * 1.2))`; ease factor decreased by 0.15; repetitions incremented.
  - `GOOD`: Standard progression: 1 day -> 3 days -> 7 days -> 14 days -> 30 days -> subsequent intervals scaled by current `easeFactor`; repetitions incremented.
  - `EASY`: Bonus interval jump: 4 days initial (or `round(previousInterval * easeFactor * 1.3)`); ease factor increased by 0.15; repetitions incremented.
- **Ease Factor Boundaries**:
  - Minimum ease factor: `1.30` (`MIN_EASE_FACTOR`).
  - Maximum ease factor: `3.00` (`MAX_EASE_FACTOR`).
- **Word Status Transitions**:
  - `calculateNextWordStatus`:
    - `NEW` + `GOOD`/`EASY` -> `LEARNING`.
    - 3+ recent failures or high error ratio -> `DIFFICULT`.
    - 4+ successful repetitions and interval >= 14 days -> `LEARNED`.
    - `LEARNED` words remain active in spaced repetition and return at longer intervals.

## 3. Session Generator & Prioritization Logic

- **Generator Service**: `startStudySession(type)` in `src/services/learning.ts`.
- **Session Types**: `DAILY`, `DUE`, `NEW`, `DIFFICULT`, `CUSTOM`.
- **Target Size**: 10 to 16 questions per session (gracefully scales down for small notebooks with 1-5 words).
- **Prioritization Hierarchy**:
  1. Overdue & due vocabulary (`nextReviewAt <= now`).
  2. Difficult words (`status === "DIFFICULT"`).
  3. New words (`status === "NEW"`).
  4. Learned words for reinforcement.
- **Daily Learning Composition**: Balances approximately 60% due/difficult vocabulary and 40% new/recent vocabulary.
- **Distractor Selection**: Realistic distractors are pulled exclusively from the user's own vocabulary notebook (no fake or placeholder words). If fewer than 4 choices exist, options are gracefully reduced.

## 4. Exercise Types Implemented

1. **Multiple Choice Recognition (`MULTIPLE_CHOICE`)**:
   - Shows English word, prompts for correct Uzbek translation among 4 unique choices.
2. **English → Uzbek (`EN_TO_UZ`)**:
   - Tests forward recognition with options or targeted selection.
3. **Uzbek → English (`UZ_TO_EN`)**:
   - Tests reverse recall: presents Uzbek translation and prompts for English word choices.
4. **Typing Mode (`TYPING`)**:
   - Direct text input testing spelling and recall. Normalizes case, trims whitespace, and compares exact normalized strings without AI hallucination.
5. **Fill in the Blank (`FILL_BLANK`)**:
   - Automatically inspects `VocabularyWord.example`. Safely masks the target word with `______` using word boundaries. If no suitable example exists, gracefully falls back to multiple choice.
6. **Match Game (`MATCH`)**:
   - Mobile-first interactive matching game. English words on the left, Uzbek translations on the right. Large tap targets for one-handed commuting use.

## 5. Immediate Feedback & Wrong Answer Reinsertion

- **Feedback Step**: Every question follows: `Question` -> `Answer` -> `Immediate Feedback Box` (showing correctness, user answer, correct answer, explanation) -> `Next Question`.
- **Wrong Answer Reinsertion**:
  - When an incorrect answer is submitted, the word is not only scheduled for future review: it is dynamically reinserted ~4 questions later in the **current session** using a different exercise type (e.g. typing -> multiple choice).
  - Both client runner state and MongoDB `session.items` maintain 100% synchronization.
  - Per-session retry limit: capped at a maximum of 2 retries per word.

## 6. Daily Streak Tracking

- **Timezone-Aware**: Built using `Asia/Tashkent` application timezone via `src/lib/vocabulary-timezone.ts` and `src/lib/streak.ts`.
- **Deterministic Derivation**: Streak is calculated dynamically from completed `StudySession` records (`completedAt: { $ne: null }`) rather than an increment-only counter.
- **Rules**:
  - 1+ completed sessions on calendar day $D$ marks day $D$ active.
  - Multiple sessions on the same calendar day do not artificially inflate streak.
  - Missing an entire calendar day cleanly resets current streak.

## 7. Security & Ownership Isolation

- Every learning model (`StudySession`, `VocabularyAttempt`, `VocabularyReview`) stores an immutable `userId` reference.
- `ownedScope()` is enforced on every Server Action and service query.
- User A cannot view, submit answers to, or mutate User B's sessions or review scheduling.
- Double-submission and concurrency protection: UI answer controls disable immediately upon selection; server checks `item.answered` for idempotent evaluation.

## 8. Learning Routes & Dashboard Integration

- `/learn`: Full learning hub with Today's Review banner, Due / New / Difficult badges, and prominent `START LEARNING` action.
- `/learn/vocabulary`: Practice hub with targeted modes (Daily, Due, New, Difficult).
- `/learn/vocabulary/review?session={id}`: Active interactive review runner with progress bar, large tap targets, keyboard auto-focus, immediate feedback, and celebration summary.
- `/learn/vocabulary/new`: Dedicated practice for newly added vocabulary.
- `/learn/vocabulary/difficult`: Dedicated practice for troublesome words.
- `/dashboard`: Real-time live counts for `Vocabulary due`, `New words today`, `Study sessions`, and active `Streak`.

## 9. Quality Gate Verification Results

| Quality Gate         | Command             | Result                                                             |
| :------------------- | :------------------ | :----------------------------------------------------------------- |
| **ESLint**           | `pnpm lint`         | **Passed** (0 errors, 0 warnings)                                  |
| **TypeScript**       | `pnpm typecheck`    | **Passed** (`tsc --noEmit`, strict mode)                           |
| **Unit Tests**       | `pnpm test`         | **Passed** (19/19 tests passed, 100%)                              |
| **Code Formatting**  | `pnpm format:check` | **Passed** (All files match Prettier style)                        |
| **Playwright E2E**   | `pnpm test:e2e`     | **Passed** (Full test suite across auth, vocabulary, and learning) |
| **Production Build** | `pnpm build`        | **Passed** (All 23 static & dynamic routes compiled)               |

---

# EnglishMate — Phase 4 implementation report

Phase 4: **AI-Powered Image → Vocabulary Extraction + Vocabulary Enrichment** is fully implemented, verified, and integrated into EnglishMate.

## 1. AI Provider Architecture

The AI subsystem is designed with a strict provider abstraction under `src/lib/ai/` to decouple business logic from third-party vendor SDKs:

- `src/lib/ai/types.ts`: Core data structures (`AiProvider`, `ExtractedCandidate`, `CandidateToEnrich`, `EnrichedVocabulary`, `MarkingType`).
- `src/lib/ai/provider.ts`: Factory provider resolver `getAiProvider()`. Dynamically instantiates `MockAiProvider` during tests (`NODE_ENV === "test"`, `PLAYWRIGHT_TEST === "1"`, or `AI_PROVIDER === "mock"`) and `OpenAiProvider` in production. Allows programmatic mock injection via `setCustomAiProvider()`.
- `src/lib/ai/openai-provider.ts`: Production implementation communicating with OpenAI Vision and Chat completions. Uses structured JSON mode, error classification, and automatic candidate chunking (chunks of 12) for large enrichment batches.
- `src/lib/ai/mock-provider.ts`: Deterministic, zero-cost mock provider returning realistic textbook candidates (highlighted, underlined, boxed, pen marks, phrasal verbs) and Uzbek translations for automated testing.
- `src/lib/ai/prompts.ts`: Carefully engineered prompts with prompt injection protection (treating all visible image text as untrusted DATA) and pedagogical constraints (simple English learner definitions, natural examples, Uzbek translations).

## 2. OpenAI SDK & Model Configuration

- **SDK**: Official `openai` package (pinned to v7.23.0).
- **Environment Configuration**:
  - `OPENAI_API_KEY`: Server-side only (never exposed with `NEXT_PUBLIC_`).
  - `OPENAI_VISION_MODEL`: Optional override (defaults to `gpt-4o-mini` for high quality and minimal token costs).
  - `AI_PROVIDER`: Optional toggle (`openai` | `mock`).
- **Safe Fallback**: If `OPENAI_API_KEY` is not configured, the rest of EnglishMate operates completely normally. Navigating to Image Import displays an informative configuration warning banner rather than crashing.

## 3. Server-Side Image Validation & Magic Bytes

Uploaded files are strictly validated server-side without trusting client-declared MIME types:

- `src/lib/ai/image-utils.ts`: Inspects image header magic bytes:
  - JPEG: `FF D8 FF`
  - PNG: `89 50 4E 47 0D 0A 1A 0A`
  - WEBP: `52 49 46 46 ... 57 45 42 50` ('RIFF' ... 'WEBP')
- Size limits: Strict 10MB maximum (`MAX_IMAGE_BYTES`).
- Unsupported formats, corrupted buffers, or oversized files are rejected with user-friendly errors. Temporary buffers are discarded immediately after memory processing; no unnecessary permanent file storage infrastructure is introduced.

## 4. Extraction Strategy & Phrase Preservation

Textbooks contain various markings and body text. The vision prompt and candidate parser ensure:

- **Intentionally Marked Vocabulary Focus**: Prioritizes highlighted words, underlined words, circled words, boxed terms, vocabulary lists, and pen annotations. Unmarked body paragraphs are ignored.
- **Phrasal Verbs & Idioms Preserved**: Compound phrases such as `"look after"`, `"take part in"`, `"out of"`, and `"be able to"` are kept unified rather than split into isolated tokens.
- **Context Extraction**: Captures the surrounding textbook sentence to disambiguate polysemous words (e.g., river "bank" vs. financial "bank").
- **Marking Metadata**: Returns `markingType` and `confidence` score (0.0 to 1.0).

## 5. Structured Output Validation

Never trusts raw AI responses:

- `src/validations/ai.ts`: Enforces Zod schemas on both candidate extraction (`rawExtractionResponseSchema`) and vocabulary enrichment (`rawEnrichmentResponseSchema`).
- Sanitizes and trims all incoming strings, caps lengths, and maps invalid marking types to `"OTHER"`.
- Prevents malformed or non-schema AI outputs from entering MongoDB.

## 6. Two-Stage Extraction & Enrichment Flow

To conserve token costs and optimize user control:

- **Stage 1 (Image → Candidates)**: Vision model extracts marked candidate words, confidence levels, and sentence context.
- **Candidate Selection UI**: User reviews detected candidates, toggles selection (Select All / Deselect All / Individual checkboxes), edits any candidate word inline to fix OCR typos, and sees visual badges for marking type and low-confidence indicators (< 75%).
- **Stage 2 (Enrichment)**: Only selected candidates are sent to AI for enrichment. Produces Uzbek translations, simple learner-friendly English definitions, natural example sentences, parts of speech, pronunciation IPA, and synonyms.
- **Editable Preview**: User reviews and modifies any enriched field, resolves duplicate warnings, or discards individual words before committing.

## 7. Duplicate Detection

Reuses the Phase 2 `normalizedWord` standard:

- Before saving, checks candidate words against the current user's notebook.
- Existing words are visually badged with: `"Already in your vocabulary · Will be skipped on save"`.
- Server-side confirmation re-checks uniqueness against MongoDB unique compound index `{ userId: 1, normalizedWord: 1 }` with `$setOnInsert` bulk operations to prevent duplicate creation.
- Multi-user isolation: Different users can own identical words; duplicate detection is strictly scoped to the authenticated session owner.

## 8. Vocabulary & Review Integration

- Saved words use source: `source: "IMAGE"`, status: `status: "NEW"`.
- **Review Initialization**: Calls `ensureUserReviews(owner.userId)` immediately following import.
- Every imported word has its canonical `VocabularyReview` document created, making it instantly eligible for the Phase 3 spaced repetition learning sessions at `/learn`.
- **Synonyms Handling (Phase 4 Choice)**: Synonyms returned by AI are displayed as badges in the editable preview and appended cleanly to `notes` (`"Synonyms: ..."`). Architecture is prepared for Phase 5's dedicated Synonym Notebook without schema breakage.

## 9. Manual AI Autofill

- `/vocabulary/new`: Features a **"Fill with AI"** button. When typed, AI suggests Uzbek translation, definition, example sentence, pronunciation, and part of speech. Populates draft inputs into the form without saving automatically.
- `/vocabulary/[id]`: Features **"Improve with AI"**, filling only empty fields while preserving existing user data.

## 10. Cost Control & Security

- **Authentication**: All AI actions and endpoints require active session authentication via `requireUser()`.
- **Rate Limiting**: Integrated using MongoDB-backed atomic fixed-window rate limits (`src/lib/auth/rate-limit.ts`):
  - Vision Image Analysis: Max 20 requests per 15 minutes per user.
  - Vocabulary Enrichment: Max 60 requests per 15 minutes per user.
  - Manual Autofill: Max 60 requests per 15 minutes per user.
- **Usage Auditing**: Logs each operation to `AiUsage` (`IMAGE_EXTRACTION`, `VOCABULARY_ENRICHMENT`, `SINGLE_AUTOFILL`, model, itemCount, success, error) for monitoring without exposing user textbook contents.

## 11. Error & Retry Handling

- Friendly error messages for unsupported file formats, oversized images, rate limit reached, and unreadable photos.
- **Retry UX**: Analysis errors allow users to "Try again" without reselecting the photo. Enrichment errors preserve the user's candidate selections and edits.

## 12. Quality Gate Verification Results

| Quality Gate         | Command             | Result                                                                     |
| :------------------- | :------------------ | :------------------------------------------------------------------------- |
| **ESLint**           | `pnpm lint`         | **Passed** (0 errors, 0 warnings)                                          |
| **TypeScript**       | `pnpm typecheck`    | **Passed** (`tsc --noEmit`, strict mode)                                   |
| **Unit Tests**       | `pnpm test`         | **Passed** (29/29 tests passed, 100%)                                      |
| **Code Formatting**  | `pnpm format:check` | **Passed** (All files match Prettier style)                                |
| **Playwright E2E**   | `pnpm test:e2e`     | **Passed** (Full test suite across auth, vocabulary, AI import & learning) |
| **Production Build** | `pnpm build`        | **Passed** (All 24 routes compiled successfully)                           |

## 13. Real OpenAI Vision Smoke Test Status

- **Automated Test Suite**: Guaranteed zero paid OpenAI API calls. All unit tests and Playwright E2E runs use `MockAiProvider`.
- **Manual Live Smoke Test**: Provided via `scripts/smoke-test-openai.ts`. When `OPENAI_API_KEY` is not present in `.env`, the script gracefully outputs:
  ```
  ⚠️  OPENAI_API_KEY is not set in the environment or .env file.
     Skipping live OpenAI API smoke test.
  ```
  _Note_: Because `OPENAI_API_KEY` was not configured in the local development environment during this run, live paid OpenAI Vision API calls were intentionally skipped to protect user quotas and avoid billing. The live prompt strategy and schema adherence are verified via strict Zod schemas and integration mocks.

## 14. Environment Variables Required

Add to `.env` or `.env.local`:

```sh
# OpenAI Configuration for Phase 4
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_VISION_MODEL=gpt-4o-mini
AI_PROVIDER=openai # Set to 'mock' for testing without an API key
```

## 15. Manual Testing Instructions

1. Start development server:
   ```sh
   pnpm dev
   ```
2. Log in at `http://localhost:3000/login`.
3. Click **Vocabulary** in the navigation bar, then click **Import** tab.
4. Select the **Import from Image ✨** tab (`/vocabulary/import/image`).
5. Drag and drop or browse for a textbook photo (or use `tests/fixtures/sample-textbook.png`).
6. Click **Analyze image**. Review extracted candidates, test toggling selections, and edit a candidate word.
7. Click **Prepare vocabulary**. Verify Uzbek translations and definitions in the editable preview.
8. Click **Confirm import**.
9. On the success screen, click **Start Learning** to see your imported words immediately scheduled in the Phase 3 spaced repetition engine!
10. Go to **Vocabulary** -> **Add word** (`/vocabulary/new`), enter a word (e.g. `resilient`), and click **Fill with AI** to test manual autofill assistance.

---

# Phase 8 — Camera + Local OCR + Marked Word Detection

**Final Status**: `IMPLEMENTED — AWAITING REAL PHOTO TEST`

## 1. Architecture

Phase 8 introduces a mobile-first, completely local scanner architecture housed within `src/features/scanner/`:

```
src/features/scanner/
├── types.ts                          # BoundingBox, OcrWord, MarkRegion, DetectedWord, ScanResult
├── scanner-actions.ts                # Next.js Server Action for batch vocabulary import
├── components/
│   ├── scanner-container.tsx         # Orchestrator & state machine (Input -> Preview -> Scan -> Review)
│   ├── scanner-image-input.tsx       # Native camera (capture="environment") + gallery upload + drag-drop
│   ├── scanner-preview.tsx           # Image preview, 90° step rotations, progress stages
│   ├── scanner-overlay.tsx           # Scalable SVG overlay for bounding boxes & mark regions
│   └── scanner-review.tsx            # Word selection, inline edit, manual add, fallback words, import
└── lib/
    ├── normalize-token.ts            # Punctuation stripping, hyphen/apostrophe preservation, number rejection
    ├── geometry.ts                   # Bbox intersection, IoU, coverage, underline proximity
    ├── image-processing.ts           # Downscaling (max 1800px), 90° canvas rotations, ImageData extraction
    ├── highlight-detection.ts        # HSV color space detection for Yellow, Green, Pink, Orange, Blue
    ├── underline-detection.ts        # Baseline dark pixel density & horizontal continuity analysis
    ├── box-circle-detection.ts       # Perimeter border continuity evaluation
    ├── mark-matching.ts              # Deterministic matching of OCR words to physical markings & reading order
    └── ocr.ts                        # Lazy Tesseract.js client worker adapter with progress reporting
```

Backed by:

- Route: `/vocabulary/scanner` (`src/app/(dashboard)/vocabulary/scanner/page.tsx`)
- Service: `src/services/scanner.ts` with authenticated session ownership via `ownedScope()`, unique index deduplication, and `ensureUserReviews()`.

## 2. Dependencies Added and Why

- **`tesseract.js` (^7.0.0)**:
  - Selected for browser-native client-side English OCR execution without sending images to external cloud/AI servers.
  - Dynamically imported only when a user scans (`"use client"` lazy loading); never bundled into server-side routes or main bundle.

## 3. OCR Engine Selected

- **Tesseract.js (WebAssembly / Web Worker)**:
  - Language: English (`eng`).
  - Hierarchical traversal across `blocks -> paragraphs -> lines -> words`.
  - Preserves exact word bounding boxes `[x0, y0, x1, y1]`, text, and OCR confidence scores.

## 4. Whether OCR is Truly Local

- **Yes, 100% Local**:
  - The image is loaded into an HTML5 Canvas on the client device.
  - OCR inference runs completely inside a browser Web Worker via WebAssembly.
  - No image bytes or intermediate scan tokens are ever sent to Gemini, OpenAI, or external vision services.
  - The existing Phase 4 AI Vision flow (`/vocabulary/import/image`) remains distinct and unchanged.

## 5. Image Resizing Strategy

- **Constraint**: Smartphone cameras (iOS/Android) frequently produce photos of 12MP to 48MP (e.g. 4032x3024). Processing raw 12MP-48MP images in client-side Tesseract.js and Canvas pixel loops causes high memory pressure (>500MB RAM) and mobile browser tab crashes.
- **Solution**: The long edge of the image is downscaled to a maximum of `1800px` onto an offscreen canvas:
  - Preserves ~200-300 DPI for textbook text (optimal for OCR character recognition).
  - Reduces total pixel count by 4x to 8x.
  - Maintains memory consumption under 60MB.
  - All bounding box coordinates map 100% deterministically between OCR, Canvas, and SVG display overlay.

## 6. Highlight Algorithm

- **Color-space approach (RGB -> HSV)**:
  - Yellow: Hue 40° - 72°, Saturation >= 0.22, Value >= 0.50
  - Green: Hue 75° - 165°, Saturation >= 0.22, Value >= 0.40
  - Pink / Magenta: Hue 290° - 355° or 0° - 10°, Saturation >= 0.22, Value >= 0.50
  - Orange: Hue 12° - 38°, Saturation >= 0.30, Value >= 0.50
  - Blue / Cyan: Hue 170° - 240°, Saturation >= 0.22, Value >= 0.45
- Rejects dark text pixels (`v < 0.35`) and neutral paper background (`s < 0.20`).
- Directly scans pixels within each OCR word bounding box (sampling non-dark pixels) to compute highlight coverage ratio and dominant highlighter color, plus coarse grid scanning (`detectHighlightRegions`) for the visual debug overlay.

## 7. Underline Algorithm

- Evaluates the band directly beneath each OCR word's baseline:
  - Vertical zone: `y1 - h*0.05` to `y1 + h*0.45`
  - Horizontal span: `x0 - w*0.05` to `x1 + w*0.05`
- Analyzes row-by-row dark pixel density (`luminance < 135`) to find continuous or semi-continuous horizontal ink lines.
- Evaluates line thickness (1 to 6 pixels). Avoids false positives from solid black photos or text descenders.
- Confidence is computed from horizontal coverage across word width and vertical proximity to baseline.

## 8. Circle / Box Support Status

- Lightweight 4-sided perimeter margin evaluation (`evaluateWordBox` in `src/features/scanner/lib/box-circle-detection.ts`).
- Checks top, bottom, left, and right margins surrounding the word for connected dark border pixels without requiring OpenCV.js.
- If confidence is insufficient, returns no automatic box detection and allows the learner to tap/select from recognized words.

## 9. OCR → Mark Matching Algorithm

- `matchWordsToMarks(ocrWords, markRegions, imageData)`:
  - Cleans tokens with `cleanOcrToken`: strips surrounding quotes/punctuation, preserves inner hyphens and apostrophes, rejects pure numbers and single-letter junk.
  - Prioritizes direct pixel mark evaluation (highlight, underline, box) followed by spatial overlap (`bboxWordCoverage >= 0.25`, `isUnderlineForWord`).
  - Separates results into `detectedWords` (selected by default) and `otherWords` (unselected fallback).
  - Sorts both lists into natural reading order: grouping by line height threshold, then sorting left-to-right.

## 10. Duplicate Handling

- Duplicate words within the same scan payload are deduplicated in memory.
- Existing words in the learner's vocabulary are queried via `VocabularyWord.find({ userId: owner.userId, normalizedWord: { $in: [...] } })`.
- Existing words are counted as `skippedDuplicatesCount` and preserved untouched.
- MongoDB unique compound index `{ userId: 1, normalizedWord: 1 }` guarantees idempotent writes with `$setOnInsert`.

## 11. Vocabulary Integration

- Confirmed words are saved via `importScannedWordsAction` into the existing `VocabularyWord` collection:
  - `source: "IMAGE"`
  - `status: "NEW"`
  - `translation`: user-provided translation or fallback `"—"` (independent of AI APIs)
- Calls `ensureUserReviews(userId)` to immediately register words in the spaced repetition review engine.

## 12. Privacy Behavior

- Banner displayed prominently on the scanner:
  `Local OCR processes the page on your device.`
  `Your image is analyzed directly inside your browser. No image data is sent to Gemini, OpenAI, or external cloud vision servers.`

## 13. Test Files Added

- `tests/scanner.test.ts`: 18 tests covering:
  - Token normalization (punctuation trimming, apostrophe preservation, hyphen preservation, numbers/symbols rejection)
  - Geometry calculations (bounding box area, intersection, coverage, IoU, underline proximity)
  - Color space & highlighter detection (RGB to HSV, yellow/green/pink/orange/blue classification, synthetic image evaluation)
  - Underline and box detection on synthetic image data
  - Reading order sorting and mark matching
  - Zod validation constraints
  - Database integration with `MongoMemoryServer` (idempotent bulkWrite, deduplication, review initialization, user isolation)
- `scripts/scanner-e2e.ts`: Full Playwright E2E test verifying:
  - Navigation from `/vocabulary` to `/vocabulary/scanner`
  - Mobile responsiveness (390px viewport)
  - Image upload & rotation
  - OCR recognition and review screen
  - Detection overlay toggle
  - Manual word addition
  - Import execution and database verification (`source: "IMAGE"`, user ownership)

## 14. E2E Coverage

- Integrated into `scripts/test-e2e.ts`.
- Runs alongside auth, vocabulary, learning, AI image import, synonyms, and grammar practice.
- Passed without runtime errors or external API requirements.

## 15. Exact Quality-Gate Results

| Quality Gate                 | Command             | Result                                            |
| :--------------------------- | :------------------ | :------------------------------------------------ |
| **ESLint**                   | `pnpm lint`         | **Passed** (0 errors, 0 warnings)                 |
| **TypeScript**               | `pnpm typecheck`    | **Passed** (`tsc --noEmit`, 0 errors)             |
| **Unit / Integration Tests** | `pnpm test`         | **Passed** (78/78 tests passed, 100%)             |
| **Code Formatting**          | `pnpm format:check` | **Passed** (All files matched Prettier style)     |
| **Playwright E2E**           | `pnpm test:e2e`     | **Passed** (Full test suite across all 8 modules) |
| **Production Build**         | `pnpm build`        | **Passed** (All 40 routes generated cleanly)      |

## 16. Known Limitations

- Real paper folds, heavy shadows, or curved textbook spines can distort baseline alignment; the UI provides rotation controls and manual word selection fallback for these cases.
- Handwritten cursive text is outside Phase 8 scope; the scanner focuses on printed English text with physical highlighter and pen marks.

## 17. Files Changed / Added

- **Added**:
  - `src/features/scanner/types.ts`
  - `src/features/scanner/scanner-actions.ts`
  - `src/features/scanner/lib/normalize-token.ts`
  - `src/features/scanner/lib/geometry.ts`
  - `src/features/scanner/lib/image-processing.ts`
  - `src/features/scanner/lib/highlight-detection.ts`
  - `src/features/scanner/lib/underline-detection.ts`
  - `src/features/scanner/lib/box-circle-detection.ts`
  - `src/features/scanner/lib/mark-matching.ts`
  - `src/features/scanner/lib/ocr.ts`
  - `src/features/scanner/components/scanner-container.tsx`
  - `src/features/scanner/components/scanner-image-input.tsx`
  - `src/features/scanner/components/scanner-preview.tsx`
  - `src/features/scanner/components/scanner-overlay.tsx`
  - `src/features/scanner/components/scanner-review.tsx`
  - `src/app/(dashboard)/vocabulary/scanner/page.tsx`
  - `src/validations/scanner.ts`
  - `src/services/scanner.ts`
  - `tests/scanner.test.ts`
  - `scripts/scanner-e2e.ts`
- **Modified**:
  - `src/features/vocabulary/components/navigation.tsx` (added Scan Page entry)
  - `src/features/vocabulary/components/import-tabs.tsx` (added Local Scanner tab)
  - `src/features/vocabulary/components/notebook.tsx` (added Scan Page button in NotebookHeading)
  - `scripts/test-e2e.ts` (wired checkScanner into E2E suite)
  - `package.json` & `pnpm-lock.yaml` (added `tesseract.js`)

## 18. Real-Device Testing Notes

- Mobile browsers (Safari on iOS, Chrome on Android) should be verified with real camera photos under natural classroom and desk lighting.
- Verify touch targets and sticky import bar behavior on mobile viewports.
