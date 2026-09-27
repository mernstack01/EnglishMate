import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db/connect";
import { GrammarTopic } from "../src/models/grammar-topic";
import { GrammarExercise } from "../src/models/grammar-exercise";
import { User } from "../src/models/user";
import {
  normalizeGrammarTitle,
  type GrammarCategory,
} from "../src/features/grammar/constants";

loadEnvConfig(process.cwd());

interface SeedExercise {
  type:
    | "MULTIPLE_CHOICE"
    | "FILL_BLANK"
    | "TEXT_INPUT"
    | "TRUE_FALSE"
    | "SENTENCE_CORRECTION";
  question: string;
  options?: string[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  explanation?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
}

interface SeedTopic {
  title: string;
  category: GrammarCategory;
  description: string;
  content: string;
  notes?: string;
  exercises: SeedExercise[];
}

const sampleTopics: SeedTopic[] = [
  {
    title: "Modal Verbs — Ability",
    category: "MODAL_VERBS",
    description:
      "Expressing ability in the present, past, and other tenses (can, could, be able to)",
    content: `## Modal Verbs: Ability

### 1. Present Ability: Can / Cannot (Can't)
We use **can** to express general ability in the present.
- *Example:* I can speak three languages fluently.
- *Negative:* She cannot (can't) drive yet.

### 2. Past Ability: Could vs Was/Were Able To
- **Could**: used for general past ability (things you could do whenever you wanted).
  - *Example:* My little sister could read when she was only four.
- **Was / Were able to**: used for a specific achievement or difficult situation in the past (managed to do).
  - *Example:* The fire was huge, but the firefighters were able to rescue everyone.
  - *Example:* After months of training, he was able to finally run a full marathon.

### 3. Other Tenses: Be Able To
Modals like *can* and *could* have no infinitive or future form. Use **be able to** for other tenses:
- *Future:* I will be able to help you tomorrow.
- *Present Perfect:* She has been able to swim since childhood.`,
    notes:
      "Remember: 'could' is general ability; for a single successful event in the past, use 'was/were able to'.",
    exercises: [
      {
        type: "MULTIPLE_CHOICE",
        question: "My little sister _____ read when she was only four.",
        options: ["can", "could", "will be able to", "has been able to"],
        correctAnswer: "could",
        explanation: "'Could' is used for general past ability.",
        difficulty: "EASY",
      },
      {
        type: "FILL_BLANK",
        question:
          "After months of training, he _____ finally run a full marathon.",
        correctAnswer: "was able to",
        acceptedAnswers: ["was able to"],
        explanation:
          "Use 'was able to' for a specific achievement or success in the past.",
        difficulty: "MEDIUM",
      },
      {
        type: "FILL_BLANK",
        question: "I _____ speak three languages fluently.",
        correctAnswer: "can",
        acceptedAnswers: ["can"],
        explanation: "'Can' is used for present ability.",
        difficulty: "EASY",
      },
      {
        type: "MULTIPLE_CHOICE",
        question:
          "The fire was huge, but the firefighters _____ rescue everyone.",
        options: ["could", "were able to", "can", "are able to"],
        correctAnswer: "were able to",
        explanation:
          "For success in a specific difficult situation in the past, use 'was/were able to', not 'could'.",
        difficulty: "MEDIUM",
      },
      {
        type: "TRUE_FALSE",
        question: "'Could' can describe general ability in the past.",
        options: ["true", "false"],
        correctAnswer: "true",
        explanation: "True. 'Could' expresses general past ability.",
        difficulty: "EASY",
      },
      {
        type: "SENTENCE_CORRECTION",
        question: "He can to swim very fast.",
        correctAnswer: "He can swim very fast.",
        acceptedAnswers: ["He can swim very fast", "He can swim very fast."],
        explanation:
          "Modal verbs are followed by the base form of the verb without 'to'.",
        difficulty: "EASY",
      },
    ],
  },
  {
    title: "Relative Clauses",
    category: "RELATIVE_CLAUSES",
    description:
      "Defining and non-defining relative clauses with who, which, whose, and that",
    content: `## Relative Clauses

### 1. Defining Relative Clauses
Give essential information about who or what we are talking about. Without this clause, the sentence is incomplete.
- Use **who** or **that** for people: *The woman who lives next door is an architect.*
- Use **which** or **that** for things: *The book which I bought yesterday is great.*
- **No commas** are used in defining relative clauses.

### 2. Non-defining Relative Clauses
Give extra, non-essential information.
- Always separated by commas: *Paris, which is the capital of France, is famous for art.*
- **Important:** You *cannot* use **that** in non-defining relative clauses.`,
    notes: "Never use 'that' after a comma in non-defining relative clauses.",
    exercises: [
      {
        type: "MULTIPLE_CHOICE",
        question: "The musician _____ wrote that song won a Grammy award.",
        options: ["who", "which", "whose", "where"],
        correctAnswer: "who",
        explanation: "Use 'who' (or 'that') for people.",
        difficulty: "EASY",
      },
      {
        type: "FILL_BLANK",
        question: "This is the phone _____ I bought yesterday.",
        correctAnswer: "which",
        acceptedAnswers: ["which", "that"],
        explanation: "Use 'which' or 'that' for things.",
        difficulty: "EASY",
      },
      {
        type: "TRUE_FALSE",
        question:
          "In non-defining relative clauses (with commas), you can replace 'which' with 'that'.",
        options: ["true", "false"],
        correctAnswer: "false",
        explanation:
          "False. 'That' cannot be used in non-defining relative clauses.",
        difficulty: "MEDIUM",
      },
    ],
  },
];

async function main() {
  await connectDB();

  // Find a target user
  const emailArg = process.argv[2];
  const user = emailArg
    ? await User.findOne({ email: emailArg.toLowerCase() })
    : await User.findOne({ role: "USER" }).sort({ createdAt: 1 });

  if (!user) {
    console.error("No suitable user found to seed grammar topics.");
    process.exitCode = 1;
    return;
  }

  console.log(`Seeding grammar topics for user: ${user.email} (${user._id})`);

  let addedTopics = 0;
  let addedExercises = 0;

  for (const item of sampleTopics) {
    const normalizedTitle = normalizeGrammarTitle(item.title);

    let topic = await GrammarTopic.findOne({
      userId: user._id,
      normalizedTitle,
    });

    if (!topic) {
      topic = await GrammarTopic.create({
        userId: user._id,
        title: item.title,
        normalizedTitle,
        category: item.category,
        description: item.description,
        content: item.content,
        notes: item.notes || "",
        status: "NEW",
        exerciseCount: item.exercises.length,
      });
      console.log(`+ Added grammar topic '${item.title}'`);
      addedTopics++;
    } else {
      console.log(`- Topic '${item.title}' already exists.`);
    }

    // Seed exercises if not present
    for (let i = 0; i < item.exercises.length; i++) {
      const ex = item.exercises[i];
      const existingEx = await GrammarExercise.findOne({
        userId: user._id,
        grammarTopicId: topic._id,
        question: ex.question,
      });

      if (!existingEx) {
        await GrammarExercise.create({
          userId: user._id,
          grammarTopicId: topic._id,
          type: ex.type,
          question: ex.question,
          options: ex.options || [],
          correctAnswer: ex.correctAnswer,
          acceptedAnswers: ex.acceptedAnswers || [ex.correctAnswer],
          explanation: ex.explanation || "",
          difficulty:
            ex.difficulty === "HARD" ? 3 : ex.difficulty === "EASY" ? 1 : 2,
          order: i,
          isActive: true,
        });
        addedExercises++;
      }
    }

    // Refresh topic exercise count
    const totalExercises = await GrammarExercise.countDocuments({
      userId: user._id,
      grammarTopicId: topic._id,
    });
    await GrammarTopic.updateOne(
      { _id: topic._id },
      { $set: { exerciseCount: totalExercises } },
    );
  }

  console.log(
    `Done! Seeded ${addedTopics} new topics and ${addedExercises} exercises.`,
  );
}

main()
  .catch((err) => {
    console.error("Grammar seeding failed:", err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
