import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import {
  getDailySessionState,
  getDailySessionSummary,
  startDailySession,
} from "@/services/daily-learning";
import { DailyLearningRunner } from "@/features/learning/components/daily-learning-runner";

export const metadata: Metadata = {
  title: "Today's Learning Practice",
};

interface PageProps {
  searchParams: Promise<{ sessionId?: string }>;
}

export default async function TodayPracticePage({ searchParams }: PageProps) {
  await requireUser();
  const { sessionId: paramSessionId } = await searchParams;

  let sessionId = paramSessionId;
  if (!sessionId) {
    try {
      sessionId = await startDailySession();
    } catch {
      redirect("/learn/today");
    }
  }

  let sessionState;
  let summary = null;

  try {
    sessionState = await getDailySessionState(sessionId);
    if (sessionState.isCompleted) {
      summary = await getDailySessionSummary(sessionId);
    }
  } catch {
    redirect("/learn/today");
  }

  return (
    <div className="py-2">
      <DailyLearningRunner session={sessionState} summary={summary} />
    </div>
  );
}
