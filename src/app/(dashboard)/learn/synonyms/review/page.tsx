import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Layers, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getSynonymStudySession,
  startSynonymSession,
  SynonymLearningError,
} from "@/services/synonym-learning";
import { SynonymReviewRunner } from "@/features/learning/components/synonym-review-runner";
import type { SessionType } from "@/models/study-session";

export const metadata: Metadata = { title: "Synonym Practice" };

interface PageProps {
  searchParams: Promise<{ session?: string; type?: string }>;
}

export default async function SynonymReviewPage({ searchParams }: PageProps) {
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
      sessionId = await startSynonymSession(sessionType);
      redirect(`/learn/synonyms/review?session=${sessionId}`);
    } catch (error) {
      if (error instanceof SynonymLearningError) {
        return (
          <div className="mx-auto max-w-md py-12 text-center">
            <Card className="p-8">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Layers className="size-6" />
              </div>
              <h1 className="text-xl font-semibold">{error.message}</h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Add a few synonym groups to start an interactive practice
                session.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button asChild>
                  <Link href="/synonyms/new">
                    Add Synonym Group <ArrowRight className="size-4 ml-1" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/synonyms">Go to Notebook</Link>
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
    session = await getSynonymStudySession(sessionId);
  } catch (error) {
    if (error instanceof SynonymLearningError) {
      redirect("/learn/synonyms");
    }
    throw error;
  }

  return <SynonymReviewRunner session={session} />;
}
