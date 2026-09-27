import { redirect } from "next/navigation";
import { startStudySession, LearningError } from "@/services/learning";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight } from "lucide-react";

export default async function PracticeNewPage() {
  try {
    const sessionId = await startStudySession("NEW");
    redirect(`/learn/vocabulary/review?session=${sessionId}`);
  } catch (error) {
    if (error instanceof LearningError) {
      return (
        <div className="mx-auto max-w-md py-12 text-center">
          <Card className="p-8">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <BookOpen className="size-6" />
            </div>
            <h1 className="text-xl font-semibold">No New Words</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              You don’t have any new words to practice right now.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild>
                <Link href="/vocabulary/new">
                  Add Word <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/learn">Back to Learn</Link>
              </Button>
            </div>
          </Card>
        </div>
      );
    }
    throw error;
  }
}
