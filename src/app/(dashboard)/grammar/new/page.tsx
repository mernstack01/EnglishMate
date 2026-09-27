import { TopicForm } from "@/features/grammar/components/topic-form";

export default function NewGrammarTopicPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          NEW GRAMMAR LESSON
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Add Grammar Topic
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define a topic, write clear lesson explanations, and add notes. You
          can add exercises right away or later.
        </p>
      </div>

      <TopicForm />
    </div>
  );
}
