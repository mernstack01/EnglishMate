import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowRight, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getGrammarSession,
  startGrammarSession,
  GrammarLearningError,
} from "@/services/grammar-learning";
import { GrammarPracticeRunner } from "@/features/learning/components/grammar-practice-runner";

export const metadata: Metadata = { title: "Grammar Mistake Practice" };

interface PageProps {
  searchParams: Promise<{ session?: string; topicId?: string }>;
}

export default async function GrammarGeneralPracticePage({
  searchParams,
}: PageProps) {
  const { session: querySessionId, topicId } = await searchParams;

  let sessionId = querySessionId;

  if (!sessionId) {
    try {
      sessionId = await startGrammarSession("MISTAKES", topicId);
      redirect(`/learn/grammar/practice?session=${sessionId}`);
    } catch (error) {
      if (error instanceof GrammarLearningError) {
        return (
          <div className="mx-auto max-w-md py-12 text-center">
            <Card className="p-8">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <CheckCircle2 className="size-6" />
              </div>
              <h1 className="text-xl font-semibold">
                No mistakes to practice!
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">
                You don&apos;t have any recent mistakes to review. Practice some
                grammar topics to build up your confidence!
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button asChild>
                  <Link href="/learn/grammar">
                    Explore Topics <ArrowRight className="size-4 ml-1" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/grammar">
                    <BookOpen className="size-4 mr-1" /> Grammar Notebook
                  </Link>
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
    session = await getGrammarSession(sessionId);
  } catch (error) {
    if (error instanceof GrammarLearningError) {
      redirect("/learn/grammar");
    }
    throw error;
  }

  return <GrammarPracticeRunner session={session} />;
}
