"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md space-y-5 p-10 text-center">
      <h1 className="text-2xl font-bold">Something didn’t load.</h1>
      <p className="text-muted-foreground">
        We couldn’t reach your learning space. Please try again in a moment.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
