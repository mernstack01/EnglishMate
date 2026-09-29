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
import { buildDailyLearningPlan } from "@/services/daily-learning";
import { getUnifiedMistakes } from "@/services/mistakes";
import { StartDailyLearningButton } from "@/features/learning/components/start-daily-learning-button";
import { StudySession } from "@/models/study-session";
import { requireUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/card";
import { displayStat } from "@/features/progress/placeholder-stats";
import { Types } from "mongoose";
export const metadata: Metadata = { title: "Dashboard" };
export default async function Dashboard() {
  const user = await requireUser();
  const userObjectId = new Types.ObjectId(user.id);
  const [
    vocabulary,
    synonyms,
    grammar,
    currentStreak,
    studySessionsCount,
    dailyPlan,
    mistakesSummary,
  ] = await Promise.all([
    vocabularyStats(),
    synonymStats(),
    grammarStats(),
    calculateUserStreak(userObjectId),
    StudySession.countDocuments({
      userId: userObjectId,
      completedAt: { $ne: null },
    }),
    buildDailyLearningPlan(userObjectId),
    getUnifiedMistakes(userObjectId),
  ]);
  const isDailyActive = Boolean(dailyPlan.activeSessionId);
  const dailyProgressText = dailyPlan.activeSessionProgress
    ? `${dailyPlan.activeSessionProgress.answered} / ${dailyPlan.activeSessionProgress.total}`
    : undefined;
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
                <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold tracking-wide text-primary">
                  {dailyPlan.totalCount} QUESTIONS · ~
                  {dailyPlan.estimatedMinutes} MIN
                </span>
              </div>
              <div className="my-6 grid grid-cols-3 divide-x border-y border-border/60 py-4 text-center">
                <div>
                  <BookOpen className="mx-auto mb-2 size-4 text-primary" />
                  <p className="text-2xl font-bold">
                    {dailyPlan.vocabularyCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground sm:text-xs">
                    Vocabulary
                  </p>
                </div>
                <div>
                  <Layers className="mx-auto mb-2 size-4 text-purple-500" />
                  <p className="text-2xl font-bold">
                    {dailyPlan.synonymsCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground sm:text-xs">
                    Synonyms
                  </p>
                </div>
                <div>
                  <Sparkles className="mx-auto mb-2 size-4 text-emerald-500" />
                  <p className="text-2xl font-bold">{dailyPlan.grammarCount}</p>
                  <p className="text-[11px] text-muted-foreground sm:text-xs">
                    Grammar
                  </p>
                </div>
              </div>
              <div className="mb-6 flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-2.5 text-xs">
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    New words today
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {displayStat(vocabulary.newToday)}
                  </p>
                </div>
                <div className="h-6 w-px bg-border/60" />
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Vocabulary due
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {displayStat(vocabulary.due)}
                  </p>
                </div>
                <div className="h-6 w-px bg-border/60" />
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Synonyms due
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {displayStat(synonyms.due)}
                  </p>
                </div>
              </div>
              <StartDailyLearningButton
                isActive={isDailyActive}
                progressText={dailyProgressText}
                className="w-full"
                size="lg"
              />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                One-click commute session adapting to your memory and mistakes.
              </p>
            </div>
          </Card>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
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
                href: "/progress",
              },
              {
                label: "Unresolved mistakes",
                icon: CircleAlert,
                value: mistakesSummary.unresolvedCount,
                hint: "Needs review",
                color: "text-rose-600 bg-rose-500/10",
                href: "/mistakes",
              },
              {
                label: "Due reviews",
                icon: Clock3,
                value: dailyPlan.dueCount,
                hint: "Spaced repetition",
                color: "text-primary bg-primary/10",
                href: "/learn/today",
              },
              {
                label: "Study sessions",
                icon: Flag,
                value: studySessionsCount,
                hint: "Completed sessions",
                color: "text-violet-500 bg-violet-500/10",
                href: "/progress",
              },
            ].map(({ label, icon: Icon, value, hint, color, href }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-4 rounded-xl border bg-card p-5 hover:border-primary/40 transition-colors sm:block"
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
              </Link>
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
