import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/auth-form";
export const metadata: Metadata = { title: "Create an account" };
export default function Register() {
  return (
    <>
      <p className="mb-3 text-xs font-bold tracking-widest text-primary">
        START SOMETHING GOOD
      </p>
      <h2 className="text-3xl font-semibold tracking-tight">Room to grow.</h2>
      <p className="mt-3 mb-8 text-sm leading-relaxed text-muted-foreground">
        Create your personal English learning space. Your next chapter starts
        here.
      </p>
      <AuthForm mode="register" />
    </>
  );
}
