"use client";
import { useActionState } from "react";
import { activationAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
export function ActivationForm({
  id,
  isActive,
  self,
}: {
  id: string;
  isActive: boolean;
  self: boolean;
}) {
  const [state, action, pending] = useActionState(activationAction, {});
  if (self)
    return <span className="text-xs text-muted-foreground">Your account</span>;
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          isActive &&
          !window.confirm(
            "Deactivate this account? They will lose access to EnglishMate immediately.",
          )
        )
          event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <Button size="sm" variant="outline" disabled={pending}>
        {pending ? "Updating…" : isActive ? "Deactivate" : "Activate"}
      </Button>
      {state.error && (
        <p role="alert" className="mt-2 max-w-44 text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="mt-2 text-xs text-primary">
          {state.success}
        </p>
      )}
    </form>
  );
}
