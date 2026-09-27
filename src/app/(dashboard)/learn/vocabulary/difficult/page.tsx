import { redirect } from "next/navigation";
import { startStudySession, LearningError } from "@/services/learning";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";

export default async function PracticeDifficultPage() {
  try {
    const sessionId = await startStudySession("DIFFICULT");
    redirect(`/learn/vocabulary/review?session=${sessionId}`);
  } catch (error) {
    if (error instanceof LearningError) {
      return (
        <div className="mx-auto max-w-md py-12 text-center">
          <Card className="p-8">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <AlertCircle className="size-6" />
            </div>
            <h1 className="text-xl font-semibold">No Difficult Words</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              Great news! You have no difficult words in your notebook.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild>
                <Link href="/learn">
                  Back to Learn <ArrowRight className="size-4 ml-1" />
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
