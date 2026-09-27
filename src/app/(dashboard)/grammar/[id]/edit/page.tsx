import { notFound } from "next/navigation";
import { getGrammarTopic } from "@/services/grammar";
import { TopicForm } from "@/features/grammar/components/topic-form";

export default async function EditGrammarTopicPage({
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
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          EDIT TOPIC
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Edit &ldquo;{topic.title}&rdquo;
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update topic title, category, lesson explanations, notes, or learning
          status.
        </p>
      </div>

      <TopicForm topic={topic} />
    </div>
  );
}
