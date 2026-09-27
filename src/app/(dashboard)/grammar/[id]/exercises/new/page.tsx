import { notFound } from "next/navigation";
import { getGrammarTopic } from "@/services/grammar";
import { ExerciseForm } from "@/features/grammar/components/exercise-form";

export default async function NewGrammarExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let topic;
  try {
    topic = await getGrammarTopic(id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ExerciseForm topicId={topic.id} topicTitle={topic.title} />
    </div>
  );
}
