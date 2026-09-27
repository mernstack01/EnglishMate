# Vocabulary notebook (Phase 2)

`services/vocabulary.ts` owns all database queries and business operations. Every exported operation calls the Phase 1 session-derived ownership helpers, including reads, aggregate counts, preview and import. Server Actions authenticate separately and return explicit serializable results. UI code does not query MongoDB. No public vocabulary API is exposed; future API handlers should call the same authenticated service operations.

## Model and review lifecycle

`VocabularyWord` stores an immutable `userId`, word and server-generated normalizedWord, translation, definition, example, pronunciation, partOfSpeech, notes, status, source, difficulty and timestamps. Normalization applies Unicode NFKC, trims/collapses whitespace, and lowercases. Accent distinctions remain intact. A unique `(userId, normalizedWord)` index enforces duplicates even during concurrent writes. Two different users can store the same word.

The one-to-one review state is **embedded** in the word instead of stored in a separate VocabularyReview collection. It initializes with nextReviewAt=now, lastReviewedAt=null, intervalDays=0, easeFactor=2.5 and all counters zero. Creation, import and deletion are atomic per word, including on standalone MongoDB; no review record can be orphaned. The parent timestamps track changes. Phase 3 may update this subdocument and add separate attempt/history collections. No scheduling algorithm or game is implemented.

Due means `review.nextReviewAt <= now` and status is not LEARNED. Marking Learned suppresses the word from the due count without fabricating review history; changing it back makes it eligible according to its original schedule. User-assigned status is not presented as proof of a completed review.

Indexes:

- `(userId, normalizedWord)` unique, for duplicate lookups and alphabetical sorting.
- `(userId, createdAt DESC, _id DESC)` for date grouping/pagination and calendar ranges.
- `(userId, status, createdAt DESC, _id DESC)` for status filtering.
- `(userId, review.nextReviewAt, status)` for due queries.

Run `pnpm db:indexes` against an existing deployment before accepting vocabulary writes. The admin seed also creates the vocabulary indexes for fresh installations. No demo words are added to persistent databases.

## Dates

Timestamps are stored as UTC instants. The application resolves one IANA timezone through `lib/vocabulary-timezone.ts`: `APP_TIMEZONE`, default `Asia/Tashkent`. The UI states this timezone. It intentionally does not guess a timezone separately in each browser; all dates, today counts and calendar aggregation agree across devices.

`lib/dates.ts` converts instants to civil YYYY-MM-DD dates and derives inclusive-start/exclusive-end bounds. It handles 23/25-hour DST days and midnight transitions rather than assuming a day is always 24 hours. To add per-user timezone later, resolve the authenticated user's preference in `vocabularyTimezone()` and pass it consistently to these helpers and MongoDB aggregation.

Calendar queries match the current user's indexed month range, then aggregate `$dateToString` with the same timezone. Only at most 31 daily counts are returned. Selecting a day queries a paginated day range; the user's full collection is never loaded for the calendar.

## Query behavior

Search matches literal, case-insensitive text in word or translation; regex metacharacters are escaped and search length is capped at 100. Search, status and exact date filters compose. The notebook uses 20-row pages with deterministic tie-breakers. Newest/oldest views group each page by civil date and show Today/Yesterday/full dates. A–Z/Z–A keep true global alphabetical order and show the creation date on each card. Invalid list filters reset with a visible message; page numbers beyond the last page are clamped.

## Import

Paste JSON or load a local .json file. The server accepts at most 300 rows / 256 KB, validates each row, and reports malformed input, invalid rows, duplicates within the file, and duplicates already belonging to the current user. Unknown fields (including ownership, dates, review state and source) are ignored. Only word/translation are required; optional fields have explicit string bounds.

Preview is read-only. Editing the text invalidates the old preview. Confirmation re-parses the original JSON and re-queries current-user duplicates; browser row flags and counts are never trusted. Invalid/duplicate rows are skipped. A single unordered bulkWrite uses `$setOnInsert` upserts with the unique user/normalized-word index, so retries and simultaneous imports do not overwrite existing words. Review state is initialized in the same write. Duplicate-key races are treated as skipped duplicates; other failures return an error and a retry-safe explanation, not a false success message.

## Security and testing

Foreign and nonexistent IDs return the same "Word not found" result. Update existence checks are scoped before duplicate validation, avoiding an oracle for another user's word. Admins follow the same ownership rules as learners. Deleted words and their review state disappear in one write.

Unit tests cover normalization, schema allowlists, injection rejection, import classifications/limits, timezone day boundaries, DST and model defaults/indexes. The real-browser integration suite tests two users, tampered create/edit/delete/status forms, foreign detail reads/search/calendar counts, imports, pagination, dashboard statistics and mobile layouts. Phase 1 authentication/admin checks remain in the suite.
