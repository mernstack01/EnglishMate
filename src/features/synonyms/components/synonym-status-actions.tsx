"use client";

import { useActionState } from "react";
import { Check, Flag } from "lucide-react";
import { statusSynonymGroupAction } from "../actions";
import { Button } from "@/components/ui/button";
import type { SynonymGroupDTO } from "@/types/synonyms";

export function SynonymStatusActions({ group }: { group: SynonymGroupDTO }) {
  const [state, action, pending] = useActionState(statusSynonymGroupAction, {});

  return (
    <form
      action={action}
      aria-label={`Change status of ${group.term}`}
      className="space-y-1.5"
    >
      <input type="hidden" name="id" value={group.id} />
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          name="status"
          value="DIFFICULT"
          disabled={pending || group.status === "DIFFICULT"}
          aria-label={`Mark ${group.term} difficult`}
          className="h-8 px-2.5 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400"
        >
          <Flag className="size-3.5 mr-1" />
          Difficult
        </Button>
        <Button
          variant="ghost"
          size="sm"
          name="status"
          value="LEARNED"
          disabled={pending || group.status === "LEARNED"}
          aria-label={`Mark ${group.term} learned`}
          className="h-8 px-2.5 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
        >
          <Check className="size-3.5 mr-1" />
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
