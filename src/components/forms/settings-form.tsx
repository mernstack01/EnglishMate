"use client";
import { useActionState } from "react";
import { settingsAction } from "@/app/actions";
import { Field } from "./field";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/types/user";
export function SettingsForm({ user }: { user: CurrentUser }) {
  const [state, action, pending] = useActionState(settingsAction, {});
  return (
    <form action={action} className="space-y-6">
      <Field
        label="Your name"
        name="name"
        defaultValue={user.name}
        autoComplete="name"
        minLength={2}
        maxLength={80}
        required
        error={state.fields?.name}
      />
      <Field
        label="Email address"
        name="email"
        type="email"
        value={user.email}
        readOnly
        disabled
        hint="Your sign-in email can’t be changed here."
      />
      <div className="space-y-2">
        <label htmlFor="preferredLanguage" className="text-sm font-medium">
          Preferred learning language
        </label>
        <select
          id="preferredLanguage"
          name="preferredLanguage"
          defaultValue={user.preferredLanguage}
          className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-ring"
        >
          <option value="EN">English</option>
          <option value="UZ">O‘zbekcha (Uzbek)</option>
        </select>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Saved for future learning explanations. The interface is currently in
          English.
        </p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-primary">
          {state.success}
        </p>
      )}
      <Button disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}
