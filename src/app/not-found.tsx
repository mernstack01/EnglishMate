import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-content-center gap-5 p-6 text-center">
      <p className="text-sm font-semibold text-primary">A SMALL DETOUR</p>
      <h1 className="text-3xl font-bold">This page isn’t here.</h1>
      <p className="text-muted-foreground">
        Let’s get you back to your learning space.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
