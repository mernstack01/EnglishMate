# Phase 5: Synonym Notebook & Learning System

This directory encapsulates the synonym management and learning system in EnglishMate.

## Core Concepts

1. **SynonymGroup (`src/models/synonym-group.ts`)**:
   - Private to each authenticated user (`userId`).
   - Contains a main anchor `term`, normalized server-side for duplicate detection per user.
   - Contains an array of synonyms `[{ word, normalizedWord, example }]`.
   - Embeds atomic spaced repetition state (`ReviewState`) initialized at creation.
   - Supports statuses: `NEW`, `LEARNING`, `DIFFICULT`, `LEARNED`.
   - Supports sources: `MANUAL`, `JSON`.

2. **SynonymReview & Spaced Repetition**:
   - Schedules reviews using the SM-2 algorithm (`src/lib/spaced-repetition.ts`).
   - Supports self-rating and automatic progression: `AGAIN`, `HARD`, `GOOD`, `EASY`.
   - Transitions statuses based on consecutive correct recall and difficulty thresholds.

3. **Practice Exercises (`src/services/synonym-learning.ts`)**:
   - `RECOGNITION`: Choose a synonym of the main term (Multiple choice).
   - `REVERSE_RECOGNITION`: Choose the main term closest to a given synonym (Multiple choice).
   - `MULTI_ANSWER`: Select all synonyms belonging to the group (Checkboxes).
   - `TYPING`: Type any synonym from the group (case and whitespace normalized).
   - `MATCH`: Tap-to-match game matching main terms with synonyms.

4. **Ownership and Privacy**:
   - All queries and mutations are strictly scoped using `ownedScope()` and `ownedDocumentScope(id)`.
   - Cross-user data isolation ensures users can never view, edit, delete, or practice other users' synonym groups.
