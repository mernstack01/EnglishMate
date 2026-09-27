// Only unimplemented learning features remain placeholders. Vocabulary metrics
// come from services/vocabulary.ts; null never claims measured user progress.
export const placeholderStats = {
  grammarExercises: null,
  currentStreak: null,
  studySessions: null,
};
export const displayStat = (value: number | null) =>
  value === null ? "—" : String(value);
