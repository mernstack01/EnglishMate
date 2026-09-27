import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { ownedScope } from "@/lib/db/ownership";
import { GrammarTopic, type GrammarTopicRecord } from "@/models/grammar-topic";
import {
  GrammarExercise,
  type GrammarExerciseRecord,
} from "@/models/grammar-exercise";
import { GrammarAttempt } from "@/models/grammar-attempt";
import {
  StudySession,
  type StudySessionRecord,
  type StudySessionItem,
} from "@/models/study-session";
import {
  isGrammarAnswerAccepted,
  normalizeGrammarAnswer,
  type GrammarExerciseType,
  type GrammarStatus,
} from "@/features/grammar/constants";
import { calculateUserStreak } from "./streak";
import type {
  GrammarQuestionDTO,
  GrammarSessionDTO,
  GrammarMistakeGroupDTO,
  GrammarMistakeItemDTO,
} from "@/types/grammar";

export class GrammarLearningError extends Error {}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Overview statistics and topic list for /learn/grammar
 */
export async function getGrammarLearningOverview() {
  const owner = await ownedScope();
  await connectDB();

  const topics = await GrammarTopic.find({ userId: owner.userId })
    .sort({ lastPracticedAt: -1, createdAt: -1 })
    .lean<Array<GrammarTopicRecord & { _id: Types.ObjectId }>>();

  const [mistakesCount, totalAttempts] = await Promise.all([
    GrammarAttempt.countDocuments({ userId: owner.userId, isCorrect: false }),
    GrammarAttempt.countDocuments({ userId: owner.userId }),
  ]);

  const topicsWithMetrics = await Promise.all(
    topics.map(async (t) => {
      const topicMistakes = await GrammarAttempt.countDocuments({
        userId: owner.userId,
        grammarTopicId: t._id,
        isCorrect: false,
      });

      // Needs practice if NEW, DIFFICULT, accuracy < 75%, or has mistakes
      const needsPractice =
        t.exerciseCount > 0 &&
        (t.status === "NEW" ||
          t.status === "DIFFICULT" ||
          t.accuracy < 75 ||
          topicMistakes > 0);

      return {
        id: t._id.toString(),
        title: t.title,
        category: t.category,
        status: t.status,
        exerciseCount: t.exerciseCount,
        accuracy: t.accuracy,
        attemptsCount: t.attemptsCount,
        mistakesCount: topicMistakes,
        needsPractice,
        lastPracticedAt: t.lastPracticedAt?.toISOString(),
      };
    }),
  );

  const needsPracticeTopics = topicsWithMetrics.filter((t) => t.needsPractice);
  const difficultTopics = topicsWithMetrics.filter(
    (t) => t.status === "DIFFICULT",
  );

  return {
    topics: topicsWithMetrics,
    totalTopics: topics.length,
    needsPracticeCount: needsPracticeTopics.length,
    difficultCount: difficultTopics.length,
    mistakesCount,
    totalAttempts,
  };
}

/**
 * Start or resume a Grammar study session
 */
export async function startGrammarSession(
  type: "TOPIC" | "MISTAKES" = "TOPIC",
  topicId?: string,
  userIdOverride?: Types.ObjectId,
): Promise<string> {
  const owner = userIdOverride
    ? { userId: userIdOverride }
    : await ownedScope();
  await connectDB();

  let targetExercises: Array<GrammarExerciseRecord & { _id: Types.ObjectId }> =
    [];
  let sessionTopicId: Types.ObjectId | undefined;

  if (type === "MISTAKES") {
    // Collect exercises where the user made mistakes recently
    const recentMistakes = await GrammarAttempt.find({
      userId: owner.userId,
      isCorrect: false,
      ...(topicId ? { grammarTopicId: new Types.ObjectId(topicId) } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .select("grammarExerciseId")
      .lean();

    const exerciseIds = Array.from(
      new Set(recentMistakes.map((m) => m.grammarExerciseId.toString())),
    ).map((id) => new Types.ObjectId(id));

    if (exerciseIds.length > 0) {
      targetExercises = await GrammarExercise.find({
        _id: { $in: exerciseIds },
        userId: owner.userId,
        isActive: true,
      }).lean<Array<GrammarExerciseRecord & { _id: Types.ObjectId }>>();
    }

    if (topicId) {
      sessionTopicId = new Types.ObjectId(topicId);
    }
  } else if (topicId) {
    sessionTopicId = new Types.ObjectId(topicId);
    const topic = await GrammarTopic.findOne({
      _id: sessionTopicId,
      userId: owner.userId,
    }).lean();
    if (!topic) throw new GrammarLearningError("Grammar topic not found.");

    // Fetch active exercises for this topic
    const allExercises = await GrammarExercise.find({
      userId: owner.userId,
      grammarTopicId: topic._id,
      isActive: true,
    }).lean<Array<GrammarExerciseRecord & { _id: Types.ObjectId }>>();

    if (allExercises.length === 0) {
      throw new GrammarLearningError(
        "This topic has no active exercises to practice.",
      );
    }

    // Prioritization:
    // 1. Previously incorrect (lastIsCorrect === false)
    // 2. Never attempted (attemptCount === 0)
    // 3. Practiced least recently
    // 4. Correct exercises
    const incorrect = allExercises.filter((e) => e.lastIsCorrect === false);
    const unattempted = allExercises.filter((e) => e.attemptCount === 0);
    const practicedOlder = allExercises
      .filter((e) => e.lastIsCorrect === true)
      .sort((a, b) => {
        const timeA = a.lastAttemptAt ? a.lastAttemptAt.getTime() : 0;
        const timeB = b.lastAttemptAt ? b.lastAttemptAt.getTime() : 0;
        return timeA - timeB;
      });

    const ordered = [
      ...shuffle(incorrect),
      ...shuffle(unattempted),
      ...practicedOlder,
    ];

    // Deduplicate and cap to 15 questions per session
    const seen = new Set<string>();
    for (const ex of ordered) {
      const id = ex._id.toString();
      if (!seen.has(id)) {
        seen.add(id);
        targetExercises.push(ex);
        if (targetExercises.length >= 15) break;
      }
    }
  } else {
    throw new GrammarLearningError("Topic ID is required to start practice.");
  }

  if (targetExercises.length === 0) {
    throw new GrammarLearningError("No exercises found for practice.");
  }

  // Build StudySession items
  const items: StudySessionItem[] = targetExercises.map((ex, idx) => ({
    grammarExerciseId: ex._id,
    exerciseType: ex.type,
    order: idx,
    answered: false,
    isCorrect: null,
    retryCount: 0,
  }));

  const session = await StudySession.create({
    userId: owner.userId,
    module: "GRAMMAR",
    grammarTopicId: sessionTopicId,
    type: "DAILY",
    totalQuestions: items.length,
    answeredQuestions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    items,
  });

  return session._id.toString();
}

/**
 * Fetch and construct session state for the runner
 */
export async function getGrammarSession(
  sessionId: string,
  userIdOverride?: Types.ObjectId,
): Promise<GrammarSessionDTO> {
  const owner = userIdOverride
    ? { userId: userIdOverride }
    : await ownedScope();
  await connectDB();

  const session = await StudySession.findOne({
    _id: new Types.ObjectId(sessionId),
    userId: owner.userId,
    module: "GRAMMAR",
  }).lean<StudySessionRecord>();

  if (!session) {
    throw new GrammarLearningError("Study session not found.");
  }

  let topicTitle = "Grammar Practice";
  if (session.grammarTopicId) {
    const topic = await GrammarTopic.findById(session.grammarTopicId)
      .select("title")
      .lean();
    if (topic) topicTitle = topic.title;
  }

  // Fetch all exercises referenced in this session
  const exerciseIds = session.items
    .map((i) => i.grammarExerciseId)
    .filter(Boolean) as Types.ObjectId[];

  const exercises = await GrammarExercise.find({
    _id: { $in: exerciseIds },
  }).lean<Array<GrammarExerciseRecord & { _id: Types.ObjectId }>>();

  const exerciseMap = new Map(exercises.map((e) => [e._id.toString(), e]));

  const questions: GrammarQuestionDTO[] = session.items.map((item, idx) => {
    const ex = exerciseMap.get(item.grammarExerciseId?.toString() || "");
    return {
      index: idx,
      exerciseId: item.grammarExerciseId?.toString() || "",
      topicId: ex?.grammarTopicId?.toString() || "",
      topicTitle,
      exerciseType:
        (item.exerciseType as GrammarExerciseType) || "MULTIPLE_CHOICE",
      prompt: ex?.question || "Exercise question",
      options: ex?.options || [],
      correctAnswer: ex?.correctAnswer || "",
      acceptedAnswers: ex?.acceptedAnswers || [],
      explanation: ex?.explanation || "",
      isAnswered: item.answered,
      isCorrect: item.isCorrect,
    };
  });

  const nextUnansweredIndex = session.items.findIndex((i) => !i.answered);
  const isCompleted =
    !!session.completedAt ||
    session.items.length === 0 ||
    session.items.every((i) => i.answered);

  return {
    id: session._id.toString(),
    topicId: session.grammarTopicId?.toString(),
    topicTitle,
    totalQuestions: session.totalQuestions,
    answeredQuestions: session.answeredQuestions,
    correctAnswers: session.correctAnswers,
    incorrectAnswers: session.incorrectAnswers,
    currentQuestionIndex: nextUnansweredIndex >= 0 ? nextUnansweredIndex : 0,
    isCompleted,
    questions,
  };
}

/**
 * Evaluates an answer, logs GrammarAttempt, updates mastery, handles wrong-answer reinsertion
 */
export async function submitGrammarAnswer(
  sessionId: string,
  questionIndex: number,
  answer: string,
  exerciseId?: string,
  userIdOverride?: Types.ObjectId,
) {
  const owner = userIdOverride
    ? { userId: userIdOverride }
    : await ownedScope();
  await connectDB();

  const session = await StudySession.findOne({
    _id: new Types.ObjectId(sessionId),
    userId: owner.userId,
    module: "GRAMMAR",
  });

  if (!session) throw new GrammarLearningError("Study session not found.");
  if (session.completedAt) {
    throw new GrammarLearningError("This session has already ended.");
  }

  // 1. Locate the target item to answer
  // Check index match, and if exerciseId is supplied verify it matches the item
  let item = session.items[questionIndex];
  if (
    !item ||
    (exerciseId && item.grammarExerciseId?.toString() !== exerciseId) ||
    item.answered
  ) {
    // If index is misaligned or already answered, find the first unanswered item matching exerciseId
    const matchingItem = session.items.find(
      (it) =>
        !it.answered &&
        (!exerciseId || it.grammarExerciseId?.toString() === exerciseId),
    );
    if (matchingItem) {
      item = matchingItem;
      questionIndex = session.items.indexOf(matchingItem);
    }
  }

  if (!item) throw new GrammarLearningError("Question not found in session.");
  if (item.answered) {
    throw new GrammarLearningError("Question has already been answered.");
  }

  const exercise = await GrammarExercise.findOne({
    _id: item.grammarExerciseId,
    userId: owner.userId,
  });

  if (!exercise) throw new GrammarLearningError("Grammar exercise not found.");

  // Evaluate correctness
  const isCorrect = isGrammarAnswerAccepted(
    answer,
    exercise.correctAnswer,
    exercise.acceptedAnswers,
    exercise.type,
  );

  // 1. Record Attempt
  await GrammarAttempt.create({
    userId: owner.userId,
    grammarTopicId: exercise.grammarTopicId,
    grammarExerciseId: exercise._id,
    studySessionId: session._id,
    exerciseType: exercise.type,
    prompt: exercise.question,
    userAnswer: answer,
    normalizedAnswer: normalizeGrammarAnswer(answer),
    correctAnswer: exercise.correctAnswer,
    isCorrect,
  });

  // 2. Update Exercise Mastery
  exercise.attemptCount += 1;
  if (isCorrect) {
    exercise.correctCount += 1;
  } else {
    exercise.incorrectCount += 1;
  }
  exercise.lastAttemptAt = new Date();
  exercise.lastIsCorrect = isCorrect;
  await exercise.save();

  // 3. Update Session Item
  item.answered = true;
  item.isCorrect = isCorrect;
  session.answeredQuestions += 1;
  if (isCorrect) {
    session.correctAnswers += 1;
  } else {
    session.incorrectAnswers += 1;
  }

  // 4. Wrong Answer Reinsertion
  // If incorrect and retryCount < 2, reinsert the exercise later in the queue
  let wasReinserted = false;
  let reinsertedQuestion: GrammarQuestionDTO | undefined = undefined;
  let reinsertIndex: number | undefined = undefined;

  if (!isCorrect && item.retryCount < 2) {
    wasReinserted = true;
    reinsertIndex = Math.min(
      session.items.length,
      questionIndex + 3, // At least 2 questions later
    );
    const retryItem: StudySessionItem = {
      grammarExerciseId: exercise._id,
      exerciseType: exercise.type,
      order: reinsertIndex,
      answered: false,
      isCorrect: null,
      retryCount: item.retryCount + 1,
    };
    session.items.splice(reinsertIndex, 0, retryItem);
    session.totalQuestions = session.items.length;
    session.items.forEach((it, i) => {
      it.order = i;
    });

    let topicTitle = "Grammar Practice";
    if (session.grammarTopicId) {
      const topic = await GrammarTopic.findById(session.grammarTopicId)
        .select("title")
        .lean();
      if (topic) topicTitle = topic.title;
    }

    reinsertedQuestion = {
      index: reinsertIndex,
      exerciseId: exercise._id.toString(),
      topicId: exercise.grammarTopicId.toString(),
      topicTitle,
      exerciseType: exercise.type as GrammarExerciseType,
      prompt: exercise.question,
      options: exercise.options || [],
      correctAnswer: exercise.correctAnswer,
      acceptedAnswers: exercise.acceptedAnswers || [],
      explanation: exercise.explanation || "",
      isAnswered: false,
      isCorrect: null,
    };
  }

  // 5. Check if all items in session are answered
  const allAnswered = session.items.every((i) => i.answered);
  if (allAnswered) {
    session.completedAt = new Date();
  }

  await session.save();

  // 6. Update Topic Mastery & Status
  await updateTopicMastery(exercise.grammarTopicId, owner.userId);

  // 7. Calculate streak if completed
  let streak = 0;
  if (allAnswered) {
    streak = await calculateUserStreak(owner.userId);
  }

  return {
    isCorrect,
    correctAnswer: exercise.correctAnswer,
    acceptedAnswers: exercise.acceptedAnswers,
    explanation: exercise.explanation,
    userAnswer: answer,
    wasReinserted,
    reinsertIndex,
    reinsertedQuestion,
    isCompleted: allAnswered,
    streak,
  };
}

/**
 * Re-evaluates topic status and accuracy based on exercise performance
 */
async function updateTopicMastery(
  topicId: Types.ObjectId,
  userId: Types.ObjectId,
) {
  const exercises = await GrammarExercise.find({
    grammarTopicId: topicId,
    userId,
    isActive: true,
  }).lean();

  if (exercises.length === 0) return;

  const totalExercises = exercises.length;
  const attemptedExercises = exercises.filter((e) => e.attemptCount > 0);
  const totalAttempts = exercises.reduce((acc, e) => acc + e.attemptCount, 0);
  const totalCorrect = exercises.reduce((acc, e) => acc + e.correctCount, 0);

  const accuracy =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const coveragePercent = Math.round(
    (attemptedExercises.length / totalExercises) * 100,
  );

  let status: GrammarStatus = "NEW";
  if (totalAttempts === 0) {
    status = "NEW";
  } else if (totalAttempts >= 5 && accuracy < 60) {
    status = "DIFFICULT";
  } else if (coveragePercent >= 75 && accuracy >= 80) {
    status = "LEARNED";
  } else {
    status = "LEARNING";
  }

  await GrammarTopic.updateOne(
    { _id: topicId },
    {
      attemptsCount: totalAttempts,
      correctCount: totalCorrect,
      accuracy,
      status,
      lastPracticedAt: new Date(),
    },
  );
}

/**
 * Retrieves recent grammar mistakes grouped by topic
 */
export async function getGrammarMistakes(): Promise<GrammarMistakeGroupDTO[]> {
  const owner = await ownedScope();
  await connectDB();

  // Fetch recent incorrect attempts
  const mistakes = await GrammarAttempt.find({
    userId: owner.userId,
    isCorrect: false,
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  if (mistakes.length === 0) return [];

  // Group by topic and fetch exercises to populate explanations
  const topicIds = Array.from(
    new Set(mistakes.map((m) => m.grammarTopicId.toString())),
  ).map((id) => new Types.ObjectId(id));

  const exerciseIds = Array.from(
    new Set(mistakes.map((m) => m.grammarExerciseId.toString())),
  ).map((id) => new Types.ObjectId(id));

  const [topics, exercises] = await Promise.all([
    GrammarTopic.find({
      _id: { $in: topicIds },
      userId: owner.userId,
    }).lean<Array<GrammarTopicRecord & { _id: Types.ObjectId }>>(),
    GrammarExercise.find({
      _id: { $in: exerciseIds },
      userId: owner.userId,
    }).lean<Array<GrammarExerciseRecord & { _id: Types.ObjectId }>>(),
  ]);

  const topicMap = new Map(topics.map((t) => [t._id.toString(), t]));
  const exerciseMap = new Map(exercises.map((e) => [e._id.toString(), e]));

  const groupsMap = new Map<string, GrammarMistakeItemDTO[]>();

  for (const m of mistakes) {
    const tId = m.grammarTopicId.toString();
    if (!groupsMap.has(tId)) {
      groupsMap.set(tId, []);
    }

    const t = topicMap.get(tId);
    const ex = exerciseMap.get(m.grammarExerciseId.toString());

    groupsMap.get(tId)!.push({
      attemptId: m._id.toString(),
      exerciseId: m.grammarExerciseId.toString(),
      topicId: tId,
      topicTitle: t?.title || "Grammar Topic",
      exerciseType:
        (m.exerciseType as GrammarExerciseType) || "MULTIPLE_CHOICE",
      question: m.prompt,
      userAnswer: m.userAnswer,
      correctAnswer: m.correctAnswer,
      explanation: ex?.explanation || "",
      createdAt: m.createdAt.toISOString(),
    });
  }

  const result: GrammarMistakeGroupDTO[] = [];
  for (const [tId, items] of groupsMap.entries()) {
    const t = topicMap.get(tId);
    if (!t) continue;
    result.push({
      topicId: tId,
      topicTitle: t.title,
      category: t.category,
      mistakesCount: items.length,
      recentMistakes: items.slice(0, 5),
    });
  }

  return result.sort((a, b) => b.mistakesCount - a.mistakesCount);
}
