import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db/connect";
import { SynonymGroup } from "../src/models/synonym-group";
import { SynonymReview } from "../src/models/synonym-review";
import { User } from "../src/models/user";
import { normalizeSynonymTerm } from "../src/features/synonyms/constants";

loadEnvConfig(process.cwd());

const sampleSynonyms = [
  {
    term: "want to",
    meaning: "xohlamoq, istamoq",
    notes:
      "'would like to' is polite; 'intend to' is formal; 'wish to' is formal desire.",
    status: "NEW" as const,
    synonyms: [
      {
        word: "would like to",
        example: "I would like to order a cup of tea, please.",
      },
      {
        word: "wish to",
        example: "The manager wishes to speak with you regarding the proposal.",
      },
      {
        word: "intend to",
        example: "We intend to complete the construction before winter.",
      },
      {
        word: "be willing to",
        example: "She is willing to help us with the preparation.",
      },
    ],
  },
  {
    term: "problem",
    meaning: "muammo, qiyinchilik",
    notes:
      "'obstacle' is something physical or figurative blocking forward progress.",
    status: "LEARNING" as const,
    synonyms: [
      {
        word: "issue",
        example: "They discussed the environmental issues facing our city.",
      },
      {
        word: "difficulty",
        example: "He encountered great difficulty solving the equation.",
      },
      {
        word: "obstacle",
        example: "Lack of funding proved to be a major obstacle.",
      },
      {
        word: "challenge",
        example: "Learning a new language is always an exciting challenge.",
      },
    ],
  },
  {
    term: "mostly",
    meaning: "asosan, ko'pincha",
    notes:
      "'primarily' is used in analytical writing; 'largely' emphasizes extent.",
    status: "NEW" as const,
    synonyms: [
      {
        word: "mainly",
        example: "The crowd consisted mainly of young college students.",
      },
      {
        word: "generally",
        example: "It is generally accepted that sleep is crucial for memory.",
      },
      {
        word: "primarily",
        example: "The program is primarily designed for high school teachers.",
      },
      {
        word: "largely",
        example: "His success was largely due to relentless persistence.",
      },
    ],
  },
  {
    term: "especially",
    meaning: "ayniqsa, xususan",
    notes: "'notably' highlights an example of special prominence.",
    status: "NEW" as const,
    synonyms: [
      {
        word: "particularly",
        example: "I love Central Asian cuisine, particularly plov.",
      },
      {
        word: "notably",
        example:
          "Several prominent authors attended, notably the poet laureate.",
      },
      {
        word: "specifically",
        example: "The grant was awarded specifically for renewable energy.",
      },
    ],
  },
  {
    term: "mix",
    meaning: "aralashtirmoq, birlashtirmoq",
    notes:
      "'blend' implies smooth transition; 'merge' implies uniting into one.",
    status: "NEW" as const,
    synonyms: [
      {
        word: "combine",
        example: "Combine the flour and butter until crumbs form.",
      },
      {
        word: "blend",
        example: "His artistic style blends classical and modern elements.",
      },
      {
        word: "merge",
        example: "The two tech companies decided to merge last year.",
      },
    ],
  },
];

async function main() {
  await connectDB();

  const user = await User.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (!user) {
    console.error("No active user found. Please register or seed admin first.");
    process.exitCode = 1;
    return;
  }

  console.log(`Seeding synonym groups for user: ${user.email} (${user._id})`);

  let added = 0;
  for (const item of sampleSynonyms) {
    const normalizedTerm = normalizeSynonymTerm(item.term);

    const existing = await SynonymGroup.findOne({
      userId: user._id,
      normalizedTerm,
    });

    if (existing) {
      console.log(`- '${item.term}' already exists, skipping.`);
      continue;
    }

    const group = await SynonymGroup.create({
      userId: user._id,
      term: item.term,
      normalizedTerm,
      meaning: item.meaning,
      notes: item.notes,
      status: item.status,
      source: "MANUAL",
      synonyms: item.synonyms.map((s) => ({
        word: s.word,
        normalizedWord: normalizeSynonymTerm(s.word),
        example: s.example || "",
      })),
      review: {
        nextReviewAt: new Date(),
        lastReviewedAt: null,
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0,
        correctCount: 0,
        incorrectCount: 0,
      },
    });

    await SynonymReview.create({
      userId: user._id,
      synonymGroupId: group._id,
      nextReviewAt: group.review.nextReviewAt,
    }).catch(() => {});

    console.log(
      `+ Added synonym group '${item.term}' with ${item.synonyms.length} synonyms.`,
    );
    added++;
  }

  console.log(`Done! Seeded ${added} synonym groups.`);
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
