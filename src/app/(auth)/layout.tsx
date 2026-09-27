import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sprout, Check } from "lucide-react";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-6 py-6 md:px-12">
        <Brand />
        <ThemeToggle />
      </header>
      <main className="mx-auto grid max-w-6xl items-center gap-16 px-6 py-10 lg:grid-cols-2 lg:py-20">
        <section className="hidden space-y-8 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-primary">
            <Sprout className="size-4" /> Small steps. Real progress.
          </div>
          <h1 className="max-w-lg text-5xl leading-tight font-semibold tracking-tight">
            Your English.
            <br />A little better,
            <br />
            <span className="text-primary">every day.</span>
          </h1>
          <p className="max-w-sm text-lg leading-relaxed text-muted-foreground">
            A calm space to build your vocabulary, grow your confidence, and
            make English part of your day.
          </p>
          <div className="space-y-3 text-sm">
            {[
              "Your own personal learning space",
              "Made for the moments in between",
              "One small step at a time",
            ].map((t) => (
              <p key={t} className="flex items-center gap-3">
                <Check className="size-4 text-primary" />
                {t}
              </p>
            ))}
          </div>
        </section>
        <section className="mx-auto w-full max-w-md rounded-3xl border bg-card p-7 shadow-sm sm:p-10">
          {children}
        </section>
      </main>
      <footer className="px-6 pb-8 text-center text-xs text-muted-foreground">
        EnglishMate · A little progress, every day.
      </footer>
    </div>
  );
}
