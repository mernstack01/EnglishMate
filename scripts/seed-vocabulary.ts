import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db/connect";
import { VocabularyWord } from "../src/models/vocabulary-word";
import { VocabularyReview } from "../src/models/vocabulary-review";
import { User } from "../src/models/user";
import { normalizeWord } from "../src/features/vocabulary/constants";

loadEnvConfig(process.cwd());

const sampleWords = [
  {
    word: "take",
    translation: "olmoq",
    definition: "lay hold of (something) with one's hands; reach for and hold",
    example: "He reached out to take the book from the shelf.",
    partOfSpeech: "verb",
    pronunciation: "/teɪk/",
  },
  {
    word: "appropriate",
    translation: "mos, munosib",
    definition: "suitable or proper in the circumstances",
    example: "This dress is appropriate for a formal interview.",
    partOfSpeech: "adjective",
    pronunciation: "/əˈprəʊpriət/",
  },
  {
    word: "litter",
    translation: "axlat",
    definition:
      "rubbish such as paper, cans, and bottles left lying in an open or public place",
    example: "Always put your litter in the bin.",
    partOfSpeech: "noun",
    pronunciation: "/ˈlɪtə/",
  },
  {
    word: "reach",
    translation: "yetib bormoq",
    definition:
      "arrive at; stretch out an arm in a specified direction in order to touch or grasp something",
    example: "We reached the station just before the train arrived.",
    partOfSpeech: "verb",
    pronunciation: "/riːtʃ/",
  },
  {
    word: "participate",
    translation: "qatnashmoq",
    definition: "take part in an action or endeavour",
    example: "All students are encouraged to participate in discussions.",
    partOfSpeech: "verb",
    pronunciation: "/pɑːˈtɪsɪpeɪt/",
  },
  {
    word: "type",
    translation: "tur, toifa",
    definition: "a category of people or things having common characteristics",
    example: "What type of music do you like best?",
    partOfSpeech: "noun",
    pronunciation: "/taɪp/",
  },
  {
    word: "close",
    translation: "yaqin; yopmoq",
    definition: "only a short distance away or separated by a short interval",
    example: "Their house is close to the city center.",
    partOfSpeech: "adjective",
    pronunciation: "/kləʊs/",
  },
  {
    word: "attract",
    translation: "jalb qilmoq",
    definition:
      "cause to come to a place or participate in a venture by offering something of interest, favorable conditions, or opportunities",
    example: "The new library attracted many young readers.",
    partOfSpeech: "verb",
    pronunciation: "/əˈtrækt/",
  },
  {
    word: "cost",
    translation: "narx; xarajat qilmoq",
    definition:
      "an amount that has to be paid or spent to buy or obtain something",
    example: "The total cost of the trip was very reasonable.",
    partOfSpeech: "noun",
    pronunciation: "/kɒst/",
  },
  {
    word: "staff",
    translation: "xodimlar",
    definition: "all the people employed by a particular organization",
    example: "The hospital staff worked tirelessly through the night.",
    partOfSpeech: "noun",
    pronunciation: "/stɑːf/",
  },
  {
    word: "build",
    translation: "qurmoq",
    definition: "construct (something) by putting parts or material together",
    example: "They plan to build a community learning centre here.",
    partOfSpeech: "verb",
    pronunciation: "/bɪld/",
  },
  {
    word: "maximum",
    translation: "eng yuqori",
    definition: "as great, high, or intense as possible or permitted",
    example: "The maximum speed allowed on this road is 60 km/h.",
    partOfSpeech: "adjective",
    pronunciation: "/ˈmæksɪməm/",
  },
  {
    word: "out of",
    translation: "...dan",
    definition:
      "indicating the source, origin, or material from which something is made or obtained",
    example: "She made a bookmark out of recycled card.",
    partOfSpeech: "preposition",
    pronunciation: "/aʊt ɒv/",
  },
  {
    word: "to",
    translation: "...ga, ...qarab",
    definition: "expressing motion in the direction of (a particular location)",
    example: "We walked to the library together.",
    partOfSpeech: "preposition",
    pronunciation: "/tuː/",
  },
];

async function main() {
  const targetEmail = process.argv[2] || process.env.ADMIN_EMAIL;
  await connectDB();
  await Promise.all([
    User.createIndexes(),
    VocabularyWord.createIndexes(),
    VocabularyReview.createIndexes(),
  ]);

  let user = targetEmail
    ? await User.findOne({ email: targetEmail.toLowerCase() })
    : null;
  if (!user) {
    user = await User.findOne({ isActive: true }).sort({ createdAt: 1 });
  }

  if (!user) {
    throw new Error(
      "No active user found to seed vocabulary for. Register a user or run seed:admin first.",
    );
  }

  console.log(
    `Seeding sample vocabulary for user: ${user.email} (${user._id})`,
  );

  let added = 0;
  let skipped = 0;

  for (const item of sampleWords) {
    const normalized = normalizeWord(item.word);
    const existing = await VocabularyWord.findOne({
      userId: user._id,
      normalizedWord: normalized,
    });

    if (existing) {
      skipped++;
      continue;
    }

    const doc = await VocabularyWord.create({
      ...item,
      userId: user._id,
      normalizedWord: normalized,
      status: "NEW",
      source: "MANUAL",
    });

    await VocabularyReview.create({
      userId: user._id,
      vocabularyWordId: doc._id,
      nextReviewAt: doc.review.nextReviewAt,
    }).catch(() => {});

    added++;
  }

  console.log(
    `Seeding complete: ${added} words added, ${skipped} already existed.`,
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Vocabulary seed failed.",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
