"use client";
import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { loginAction, registerAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "./field";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const [state, action, pending] = useActionState(
    registering ? registerAction : loginAction,
    {},
  );
  return (
    <form action={action} className="space-y-5">
      {registering && (
        <Field
          label="Your name"
          name="name"
          placeholder="What should we call you?"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          error={state.fields?.name}
        />
      )}
      <Field
        label="Email address"
        name="email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        required
        maxLength={254}
        error={state.fields?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        placeholder={
          registering ? "Create a strong password" : "Enter your password"
        }
        autoComplete={registering ? "new-password" : "current-password"}
        required
        minLength={registering ? 4 : 1}
        maxLength={72}
        hint={registering ? "At least 4 characters." : undefined}
        error={state.fields?.password}
      />
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}
      <Button className="w-full" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" /> Please wait…
          </>
        ) : (
          <>
            {registering ? "Create your account" : "Sign in"}
            <ArrowRight />
          </>
        )}
      </Button>
      <p className="pt-2 text-center text-sm text-muted-foreground">
        {registering ? "Already have an account?" : "New to EnglishMate?"}{" "}
        <Link
          className="font-semibold text-primary underline-offset-4 hover:underline"
          href={registering ? "/login" : "/register"}
        >
          {registering ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
