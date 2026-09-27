import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Sparkles, AlertCircle, Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getLearningOverview } from "@/services/learning";
import { StartSessionButton } from "@/features/learning/components/start-session-button";

export const metadata: Metadata = { title: "Vocabulary Practice Modes" };

export default async function VocabularyLearnHubPage() {
  const overview = await getLearningOverview();

  const modes = [
    {
      title: "Daily Balanced Review",
      description:
        "The recommended mode: balances mature reviews (~60%) and recent/new words (~40%).",
      type: "DAILY" as const,
      badge: `${overview.dueCount} due`,
      icon: Brain,
      color: "text-primary bg-primary/10",
    },
    {
      title: "Spaced Repetition Due",
      description: "Review only words that have matured on your SM-2 schedule.",
      type: "DUE" as const,
      badge: `${overview.dueCount} due`,
      icon: Clock,
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "New Words Practice",
      description:
        "Build initial familiarity with newly added vocabulary using multiple-choice prompts.",
      type: "NEW" as const,
      badge: `${overview.newCount} new today`,
      icon: Sparkles,
      color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Difficult Words & Mistakes",
      description:
        "Target words you previously struggled with or marked as difficult.",
      type: "DIFFICULT" as const,
      badge: `${overview.difficultCount} difficult`,
      icon: AlertCircle,
      color: "text-amber-500 bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Learning Modes
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Vocabulary Practice
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a targeted practice mode or jump straight into your daily
          review.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <Card
              key={mode.title}
              className="flex flex-col justify-between p-6 hover:border-primary/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl ${mode.color}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    {mode.badge}
                  </span>
                </div>
                <h2 className="mt-4 font-semibold text-lg">{mode.title}</h2>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  {mode.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t">
                <StartSessionButton
                  type={mode.type}
                  label={`Start ${mode.type.toLowerCase()} session`}
                  className="w-full"
                />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="pt-2 text-center text-xs text-muted-foreground">
        <Link href="/learn" className="hover:text-primary transition-colors">
          ← Back to Learn Overview
        </Link>
      </div>
    </div>
  );
}
