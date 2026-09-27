import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getGrammarSession,
  startGrammarSession,
  GrammarLearningError,
} from "@/services/grammar-learning";
import { GrammarPracticeRunner } from "@/features/learning/components/grammar-practice-runner";

export const metadata: Metadata = { title: "Grammar Practice" };

interface PageProps {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ session?: string }>;
}

export default async function GrammarTopicPracticePage({
  params,
  searchParams,
}: PageProps) {
  const { topicId } = await params;
  const { session: querySessionId } = await searchParams;

  let sessionId = querySessionId;

  if (!sessionId) {
    try {
      sessionId = await startGrammarSession("TOPIC", topicId);
      redirect(`/learn/grammar/${topicId}/practice?session=${sessionId}`);
    } catch (error) {
      if (error instanceof GrammarLearningError) {
        return (
          <div className="mx-auto max-w-md py-12 text-center">
            <Card className="p-8">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <BookOpen className="size-6" />
              </div>
              <h1 className="text-xl font-semibold">{error.message}</h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Add at least one exercise to this topic to start practicing.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button asChild>
                  <Link href={`/grammar/${topicId}/exercises/new`}>
                    Add Exercise <ArrowRight className="size-4 ml-1" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/grammar/${topicId}`}>
                    <ArrowLeft className="size-4 mr-1" /> Topic Notes
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
      redirect(`/learn/grammar/${topicId}`);
    }
    throw error;
  }

  return <GrammarPracticeRunner session={session} />;
}
