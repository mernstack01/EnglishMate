import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpen,
  Sparkles,
  PenLine,
  Flame,
  Flag,
  CalendarDays,
  Sprout,
  Layers,
  CircleAlert,
  ChartNoAxesCombined,
  Clock3,
  Leaf,
} from "lucide-react";
import { vocabularyStats } from "@/services/vocabulary";
import { synonymStats } from "@/services/synonyms";
import { grammarStats } from "@/services/grammar";
import { calculateUserStreak } from "@/services/streak";
import { StudySession } from "@/models/study-session";
import { requireUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { displayStat } from "@/features/progress/placeholder-stats";
import { Types } from "mongoose";
export const metadata: Metadata = { title: "Dashboard" };
export default async function Dashboard() {
  const user = await requireUser();
  const userObjectId = new Types.ObjectId(user.id);
  const [vocabulary, synonyms, grammar, currentStreak, studySessionsCount] =
    await Promise.all([
      vocabularyStats(),
      synonymStats(),
      grammarStats(),
      calculateUserStreak(userObjectId),
      StudySession.countDocuments({
        userId: userObjectId,
        completedAt: { $ne: null },
      }),
    ]);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground">
            MAKE ROOM FOR A LITTLE PROGRESS
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Hello, {user.name.split(" ")[0]}
            <span className="text-primary">.</span>{" "}
            <span className="inline-block text-2xl" aria-hidden="true">
              ☀️
            </span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Good things grow with a little practice. You’re in the right place.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" /> Your learning
          journey begins here
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total vocabulary",
            value: vocabulary.total,
            href: "/vocabulary",
            hint: "Every word you’ve collected",
          },
          {
            label: "Synonym groups",
            value: synonyms.total,
            href: "/synonyms",
            hint: "Clusters of nuanced expressions",
          },
          {
            label: "Grammar topics",
            value: grammar.totalTopics,
            href: "/grammar",
            hint: "Rules and exercise topics",
          },
          {
            label: "Difficult items",
            value: vocabulary.difficult + synonyms.difficult,
            href: "/vocabulary?status=DIFFICULT",
            hint: "Extra practice when you’re ready",
          },
        ].map((item) => (
          <Link
            href={item.href}
            key={item.label}
            className="rounded-2xl border bg-card p-5 hover:border-primary/40"
          >
            <p className="text-xs font-semibold text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-primary">
              {item.value}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{item.hint}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="relative overflow-hidden bg-secondary px-6 pt-7 pb-8 sm:px-8">
              <div className="relative z-10 sm:max-w-[75%]">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[.12em] text-primary">
                  <Sparkles className="size-3.5" /> A FRESH START
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Big goals.
                  <br />
                  Small daily steps.
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Your personal English practice, all in one place.
                  <br className="hidden sm:block" /> Let’s make a little
                  progress today.
                </p>
              </div>
              <div
                aria-hidden="true"
                className="absolute right-3 bottom-0 hidden h-48 w-32 items-center justify-center sm:right-8 sm:flex sm:w-44"
              >
                <div className="absolute bottom-4 size-32 rounded-full bg-primary/5 sm:size-40" />
                <Sprout
                  className="relative size-28 -rotate-12 text-primary/65 sm:size-36"
                  strokeWidth={1}
                />
                <span className="absolute top-3 right-3 text-2xl text-primary/50">
                  ✦
                </span>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Today’s learning</h2>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold tracking-wide text-primary">
                  SPACED REPETITION ACTIVE
                </span>
              </div>
              <div className="my-6 grid grid-cols-3 divide-x">
                {[
                  {
                    label: "Vocabulary due",
                    value: vocabulary.due,
                    icon: BookOpen,
                  },
                  {
                    label: "Synonyms due",
                    value: synonyms.due,
                    icon: Layers,
                  },
                  {
                    label: "New words today",
                    value: vocabulary.newToday,
                    icon: Sparkles,
                  },
                ].map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="px-2 text-center first:pl-0 last:pr-0"
                  >
                    <Icon className="mx-auto mb-3 size-5 text-primary" />
                    <p className="text-2xl font-semibold">
                      {displayStat(value)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              <Button asChild className="w-full">
                <Link href="/learn">
                  Start learning <ArrowRight />
                </Link>
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Daily spaced repetition is ready. Test your recall.
              </p>
            </div>
          </Card>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Current streak",
                icon: Flame,
                value: currentStreak,
                hint:
                  currentStreak > 0
                    ? `${currentStreak} days active`
                    : "One day at a time",
                color: "text-amber-600 bg-amber-500/10",
              },
              {
                label: "Words learned",
                icon: BookOpen,
                value: vocabulary.learned,
                hint: "A growing vocabulary",
                color: "text-primary bg-secondary",
              },
              {
                label: "Study sessions",
                icon: Flag,
                value: studySessionsCount,
                hint: "Completed sessions",
                color: "text-violet-500 bg-violet-500/10",
              },
            ].map(({ label, icon: Icon, value, hint, color }) => (
              <Card
                key={label}
                className="flex items-center gap-4 p-5 sm:block"
              >
                <span
                  className={`inline-flex size-9 items-center justify-center rounded-xl ${color}`}
                >
                  <Icon className="size-[18px]" />
                </span>
                <div>
                  <p className="mt-0 text-2xl font-semibold sm:mt-4">
                    {displayStat(value)}
                  </p>
                  <p className="text-xs font-medium">{label}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {hint}
                  </p>
                </div>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Vocabulary review schedules, streaks, study sessions, and grammar
            notebook practice are live.
          </p>
        </div>
        <aside className="space-y-5">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">A habit worth building</h2>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              You don’t need hours. Just a little space in your day.
            </p>
            <div
              className="mt-6 flex justify-between"
              aria-label="Weekly activity preview"
            >
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i} className="text-center">
                  <span className="text-[10px] text-muted-foreground">{d}</span>
                  <div className="mt-2 flex size-7 items-center justify-center rounded-full border border-dashed bg-muted/50 text-muted-foreground">
                    <span className="size-1 rounded-full bg-border" />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 border-t pt-4 text-[11px] text-muted-foreground">
              Your first session will be your first step.
            </p>
          </Card>
          <Card className="p-6">
            <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-widest text-primary">
              <Leaf className="size-3.5" /> A FRIENDLY REMINDER
            </span>
            <p className="mt-4 text-lg leading-relaxed font-medium tracking-tight">
              “You don’t have to be perfect to make progress.”
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Show up. Stay curious. Keep growing.
            </p>
          </Card>
          <div className="flex gap-3 px-2 py-1 text-muted-foreground">
            <Clock3 className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs leading-relaxed">
              On the bus or on a break —<br />
              your learning space goes with you.
            </p>
          </div>
        </aside>
      </div>
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Explore your workspace</h2>
          <span className="text-xs text-muted-foreground">
            Built around you
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              href: "/vocabulary",
              title: "Vocabulary",
              description: "Give new words a home",
              icon: BookOpen,
            },
            {
              href: "/synonyms",
              title: "Synonyms",
              description: "Find another way to say it",
              icon: Layers,
            },
            {
              href: "/grammar",
              title: "Grammar",
              description: "Build your confidence",
              icon: PenLine,
            },
            {
              href: "/mistakes",
              title: "Mistakes",
              description: "Turn slips into stepping stones",
              icon: CircleAlert,
            },
          ].map(({ href, title, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Icon className="size-5 text-primary" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {description}
                </span>
              </span>
              <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
          ))}
        </div>
        <Link
          href="/progress"
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-primary"
        >
          <ChartNoAxesCombined className="size-4" /> Visit your progress space{" "}
          <ArrowRight className="size-3.5" />
        </Link>
      </section>
    </div>
  );
}
