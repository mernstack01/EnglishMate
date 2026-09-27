import { notFound } from "next/navigation";
import { getGrammarTopic, getGrammarExercise } from "@/services/grammar";
import { ExerciseForm } from "@/features/grammar/components/exercise-form";

export default async function EditGrammarExercisePage({
  params,
}: {
  params: Promise<{ id: string; exerciseId: string }>;
}) {
  const { id, exerciseId } = await params;

  let topic;
  let exercise;
  try {
    topic = await getGrammarTopic(id);
    exercise = await getGrammarExercise(exerciseId);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ExerciseForm
        topicId={topic.id}
        topicTitle={topic.title}
        exercise={exercise}
      />
    </div>
  );
}
