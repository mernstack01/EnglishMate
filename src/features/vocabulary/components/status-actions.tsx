"use client";
import { useActionState } from "react";
import { Check, Flag } from "lucide-react";
import { statusWordAction } from "../actions";
import { Button } from "@/components/ui/button";
import type { VocabularyDTO } from "@/types/vocabulary";
export function StatusActions({ word }: { word: VocabularyDTO }) {
  const [state, action, pending] = useActionState(statusWordAction, {});
  return (
    <form
      action={action}
      aria-label={`Change status of ${word.word}`}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={word.id} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          name="status"
          value="DIFFICULT"
          disabled={pending || word.status === "DIFFICULT"}
          aria-label={`Mark ${word.word} difficult`}
        >
          <Flag />
          Difficult
        </Button>
        <Button
          variant="ghost"
          size="sm"
          name="status"
          value="LEARNED"
          disabled={pending || word.status === "LEARNED"}
          aria-label={`Mark ${word.word} learned`}
        >
          <Check />
          Learned
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-xs text-primary">
          {state.success}
        </p>
      )}
    </form>
  );
}
