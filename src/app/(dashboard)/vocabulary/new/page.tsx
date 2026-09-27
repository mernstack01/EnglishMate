import { WordForm } from "@/features/vocabulary/components/word-form";
export default function NewWordPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-widest text-primary">
          ONE WORD AT A TIME
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          A new word. A new possibility.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Write it down now. Make it yours with practice later.
        </p>
      </div>
      <WordForm />
    </div>
  );
}
