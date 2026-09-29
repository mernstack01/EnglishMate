"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { startMistakesPracticeAction } from "@/features/learning/daily-actions";
import type {
  UnifiedMistakesSummaryDTO,
  MistakeTabFilter,
  MistakeSortFilter,
} from "@/types/mistakes";

interface MistakesBookProps {
  initialSummary: UnifiedMistakesSummaryDTO;
}

export function MistakesBook({ initialSummary }: MistakesBookProps) {
  const [selectedModule, setSelectedModule] = useState<MistakeTabFilter>("ALL");
  const [selectedSort, setSelectedSort] =
    useState<MistakeSortFilter>("UNRESOLVED");
  const [isPending, startTransition] = useTransition();

  // Filter items client-side for ultra-fast instant UI responsiveness
  let filteredItems = initialSummary.items;

  if (selectedModule !== "ALL") {
    filteredItems = filteredItems.filter((i) => i.module === selectedModule);
  }

  if (selectedSort === "UNRESOLVED") {
    filteredItems = filteredItems.filter((i) => !i.isResolved);
  } else if (selectedSort === "MOST_REPEATED") {
    filteredItems = [...filteredItems].sort(
      (a, b) => b.mistakesCount - a.mistakesCount,
    );
  } else {
    // RECENT
    filteredItems = [...filteredItems].sort(
      (a, b) =>
        new Date(b.lastMistakeAt).getTime() -
        new Date(a.lastMistakeAt).getTime(),
    );
  }

  const handlePracticeAll = () => {
    startTransition(async () => {
      await startMistakesPracticeAction(selectedModule);
    });
  };

  const unresolvedCount = initialSummary.unresolvedCount;

  return (
    <div className="space-y-6">
      {/* Header and Practice CTA */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <AlertCircle className="size-3.5 text-rose-500" />
            <span>Targeted Reinforcement</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Mistake Book
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Review and drill your missed words, synonyms, and grammar questions.
            Items automatically resolve after 2 consecutive correct answers.
          </p>
        </div>

        {unresolvedCount > 0 && (
          <Button
            size="lg"
            className="shadow-sm"
            disabled={isPending}
            onClick={handlePracticeAll}
          >
            <RotateCcw className="mr-2 size-4" />
            {isPending ? "Starting Practice…" : "Practice Unresolved Mistakes"}
          </Button>
        )}
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Missed Items</p>
          <p className="mt-1 text-2xl font-bold">
            {initialSummary.totalMistakesCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
            Unresolved
          </p>
          <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {initialSummary.unresolvedCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Resolved
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {initialSummary.resolvedCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Mastery Status</p>
          <p className="mt-1 text-2xl font-bold text-primary">
            {initialSummary.totalMistakesCount > 0
              ? `${Math.round((initialSummary.resolvedCount / initialSummary.totalMistakesCount) * 100)}%`
              : "100%"}
          </p>
        </Card>
      </div>

      {/* Module Tabs & Sort Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        {/* Module Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={selectedModule === "ALL" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedModule("ALL")}
            className="text-xs"
          >
            All Modules ({initialSummary.totalMistakesCount})
          </Button>
          <Button
            variant={selectedModule === "VOCABULARY" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedModule("VOCABULARY")}
            className="text-xs gap-1.5"
          >
            <BookOpen className="size-3 text-primary" />
            Vocabulary ({initialSummary.moduleCounts.VOCABULARY})
          </Button>
          <Button
            variant={selectedModule === "SYNONYMS" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedModule("SYNONYMS")}
            className="text-xs gap-1.5"
          >
            <Layers className="size-3 text-purple-500" />
            Synonyms ({initialSummary.moduleCounts.SYNONYMS})
          </Button>
          <Button
            variant={selectedModule === "GRAMMAR" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedModule("GRAMMAR")}
            className="text-xs gap-1.5"
          >
            <Sparkles className="size-3 text-emerald-500" />
            Grammar ({initialSummary.moduleCounts.GRAMMAR})
          </Button>
        </div>

        {/* Sort / Status Toggle */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground mr-1">Show:</span>
          <Button
            variant={selectedSort === "UNRESOLVED" ? "outline" : "ghost"}
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => setSelectedSort("UNRESOLVED")}
          >
            Unresolved
          </Button>
          <Button
            variant={selectedSort === "MOST_REPEATED" ? "outline" : "ghost"}
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => setSelectedSort("MOST_REPEATED")}
          >
            Most Repeated
          </Button>
          <Button
            variant={selectedSort === "RECENT" ? "outline" : "ghost"}
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => setSelectedSort("RECENT")}
          >
            Recent
          </Button>
        </div>
      </div>

      {/* Mistake Items List */}
      {filteredItems.length > 0 ? (
        <div className="grid gap-4">
          {filteredItems.map((item) => {
            const formattedDate = new Date(
              item.lastMistakeAt,
            ).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });

            return (
              <Card
                key={`${item.module}_${item.id}`}
                className="overflow-hidden border p-5 sm:p-6 space-y-4 hover:border-border transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.module === "VOCABULARY" && (
                      <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        <BookOpen className="size-3" /> VOCABULARY
                      </span>
                    )}
                    {item.module === "SYNONYMS" && (
                      <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                        <Layers className="size-3" /> SYNONYMS
                      </span>
                    )}
                    {item.module === "GRAMMAR" && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="size-3" /> GRAMMAR
                      </span>
                    )}
                    {item.subTitle && (
                      <span className="text-xs text-muted-foreground font-medium">
                        · {item.subTitle}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                      {item.mistakesCount} mistake
                      {item.mistakesCount > 1 ? "s" : ""}
                    </span>

                    {item.isResolved ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" /> Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <AlertCircle className="size-3" /> Unresolved
                      </span>
                    )}
                  </div>
                </div>

                {/* Prompt / Title */}
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-foreground">
                    {item.title}
                  </h3>
                </div>

                {/* Answer Comparison Box */}
                <div className="grid gap-3 sm:grid-cols-2 rounded-xl bg-secondary/30 p-3.5 text-sm">
                  <div>
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      Your recent answer:
                    </span>
                    <p className="mt-0.5 font-semibold text-foreground">
                      {item.latestWrongAnswer || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Correct answer:
                    </span>
                    <p className="mt-0.5 font-semibold text-foreground">
                      {item.correctAnswer}
                    </p>
                  </div>
                </div>

                {/* Footer and Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/40 text-xs text-muted-foreground">
                  <span>Last mistake: {formattedDate}</span>

                  <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm" className="h-8">
                      <Link href={item.linkHref}>
                        View in Notebook{" "}
                        <ExternalLink className="ml-1 size-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Empty Filter State */
        <Card className="p-8 text-center space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="size-6" />
          </div>
          <h2 className="text-lg font-bold">No mistakes found</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {selectedSort === "UNRESOLVED"
              ? "All your recorded mistakes for this view have been resolved with consecutive correct answers!"
              : "No mistakes matching this filter. Keep up the high standard!"}
          </p>
        </Card>
      )}
    </div>
  );
}
