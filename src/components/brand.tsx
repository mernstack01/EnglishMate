import Link from "next/link";
import { BookOpen } from "lucide-react";
export function Brand() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2.5 font-bold tracking-tight text-xl"
      aria-label="EnglishMate home"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <BookOpen className="size-5" strokeWidth={2.2} />
      </span>
      <span>
        English<span className="text-primary">Mate</span>
        <span className="text-primary">.</span>
      </span>
    </Link>
  );
}
