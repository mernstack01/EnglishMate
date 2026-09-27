import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getStudySession,
  startStudySession,
  LearningError,
} from "@/services/learning";
import { ReviewRunner } from "@/features/learning/components/review-runner";
import type { SessionType } from "@/models/study-session";

export const metadata: Metadata = { title: "Vocabulary Review" };

interface PageProps {
  searchParams: Promise<{ session?: string; type?: string }>;
}

export default async function ReviewPage({ searchParams }: PageProps) {
  const params = await searchParams;

  let sessionId = params.session;

  if (!sessionId) {
    const sessionType: SessionType =
      params.type === "DUE" ||
      params.type === "NEW" ||
      params.type === "DIFFICULT"
        ? params.type
        : "DAILY";

    try {
      sessionId = await startStudySession(sessionType);
      redirect(`/learn/vocabulary/review?session=${sessionId}`);
    } catch (error) {
      if (error instanceof LearningError) {
        return (
          <div className="mx-auto max-w-md py-12 text-center">
            <Card className="p-8">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <BookOpen className="size-6" />
              </div>
              <h1 className="text-xl font-semibold">{error.message}</h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Add a few vocabulary words to start an interactive review
                session.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button asChild>
                  <Link href="/vocabulary/new">
                    Add Word <ArrowRight className="size-4 ml-1" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/vocabulary">Go to Notebook</Link>
                </Button>
              </div>
            </Card>
          </div>
        );
      }
      throw error;
    }
  }

  let session;
  try {
    session = await getStudySession(sessionId);
  } catch (error) {
    if (error instanceof LearningError) {
      redirect("/learn");
    }
    throw error;
  }

  return <ReviewRunner session={session} />;
}
