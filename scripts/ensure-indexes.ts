import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db/connect";
import { VocabularyWord } from "../src/models/vocabulary-word";
import { VocabularyReview } from "../src/models/vocabulary-review";
import { StudySession } from "../src/models/study-session";
import { VocabularyAttempt } from "../src/models/vocabulary-attempt";
import { SynonymGroup } from "../src/models/synonym-group";
import { SynonymReview } from "../src/models/synonym-review";
import { SynonymAttempt } from "../src/models/synonym-attempt";
import { GrammarTopic } from "../src/models/grammar-topic";
import { GrammarExercise } from "../src/models/grammar-exercise";
import { GrammarAttempt } from "../src/models/grammar-attempt";
import { User } from "../src/models/user";
import { RateLimit } from "../src/models/rate-limit";
import { AiUsage } from "../src/models/ai-usage";
loadEnvConfig(process.cwd());
async function main() {
  await connectDB();
  await Promise.all([
    User.createIndexes(),
    RateLimit.createIndexes(),
    VocabularyWord.createIndexes(),
    VocabularyReview.createIndexes(),
    StudySession.createIndexes(),
    VocabularyAttempt.createIndexes(),
    AiUsage.createIndexes(),
    SynonymGroup.createIndexes(),
    SynonymReview.createIndexes(),
    SynonymAttempt.createIndexes(),
    GrammarTopic.createIndexes(),
    GrammarExercise.createIndexes(),
    GrammarAttempt.createIndexes(),
  ]);
  console.log("EnglishMate indexes are ready.");
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Index creation failed.",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
