import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/auth-form";
export const metadata: Metadata = { title: "Welcome back" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const { registered } = await searchParams;
  return (
    <>
      <p className="mb-3 text-xs font-bold tracking-widest text-primary">
        YOUR NEXT CHAPTER
      </p>
      <h2 className="text-3xl font-semibold tracking-tight">Welcome back.</h2>
      <p className="mt-3 mb-8 text-sm leading-relaxed text-muted-foreground">
        A little practice goes a long way. Let’s pick up where you left off.
      </p>
      {registered === "1" && (
        <p
          role="status"
          className="mb-5 rounded-xl bg-secondary p-3 text-sm text-primary"
        >
          Your account is ready. Sign in to get started.
        </p>
      )}
      <AuthForm mode="login" />
    </>
  );
}
