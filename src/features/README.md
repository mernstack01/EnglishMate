# Feature boundaries

Phase 2 implements the vocabulary notebook with server actions, validated services, a user-owned VocabularyWord model and embedded review state. Synonyms, grammar, learning games and general progress remain future modules; their unavailable metrics remain explicit placeholders. See vocabulary/README.md for the notebook architecture.

Future server services must call `ownedScope()` or `ownedDocumentScope(id)` for EVERY user-owned read, update, and delete. These helpers derive identity from the server session, never an input parameter. For creation, set `userId` from `await ownedScope()` after validating allowed fields; never spread a raw request body. Return explicit DTOs, not Mongoose documents.

Add `userOwnershipFields` to each schema and index `userOwnershipIndex`. Add feature-specific compound indexes with `userId` as the first key. Do not allow callers to override the ownership filter. Admin user management is separate from private learning data access; being an admin does not imply permission to read another user's learning documents.
