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
      <div className="space-y-2">
        <label htmlFor="dailyQuestionGoal" className="text-sm font-medium">
          Daily study target
        </label>
        <select
          id="dailyQuestionGoal"
          name="dailyQuestionGoal"
          defaultValue={user.dailyQuestionGoal || 20}
          className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-ring"
        >
          <option value="10">10 questions / day (~7-8 min)</option>
          <option value="15">15 questions / day (~10-12 min)</option>
          <option value="20">20 questions / day (~15 min - Recommended)</option>
          <option value="30">30 questions / day (~20-25 min)</option>
          <option value="40">40 questions / day (~30 min)</option>
        </select>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Sets your baseline daily plan size for commute learning.
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
