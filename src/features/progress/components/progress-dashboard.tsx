"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  BookOpen,
  Layers,
  Flame,
  ArrowRight,
  TrendingUp,
  Award,
  Calendar,
  AlertTriangle,
  Lightbulb,
  Target,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GrammarCategoryBadge,
  GrammarStatusBadge,
} from "@/features/grammar/components/grammar-notebook";
import type { GrammarStatus } from "@/features/grammar/constants";
import type { ProgressAnalyticsDTO } from "@/types/progress";

interface ProgressDashboardProps {
  data: ProgressAnalyticsDTO;
}

type TabKey = "overview" | "vocabulary" | "synonyms" | "grammar" | "activity";

export function ProgressDashboard({ data }: ProgressDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const {
    mastery,
    vocabulary: vocab,
    synonyms,
    grammar,
    activity30Days,
    recommendations,
  } = data;

  // Circular gauge parameters
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (mastery.overallScore / 100) * circumference;

  return (
    <div className="space-y-8">
      {/* 1. HERO MASTERY CARD */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8 shadow-sm">
        <div className="relative z-10 grid gap-6 md:grid-cols-12 md:items-center">
          {/* Circular Score Gauge */}
          <div className="flex items-center gap-5 md:col-span-5">
            <div className="relative flex size-28 shrink-0 items-center justify-center">
              <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  className="stroke-muted"
                  strokeWidth="8"
                  fill="transparent"
                  r={radius}
                  cx="50"
                  cy="50"
                />
                <circle
                  className="stroke-primary transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  r={radius}
                  cx="50"
                  cy="50"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black tracking-tight text-foreground">
                  {mastery.overallScore}%
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Mastery
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Award className="size-3.5" />
                <span>
                  CEFR {mastery.cefr.level} · {mastery.cefr.title}
                </span>
              </div>
              <h2 className="text-lg font-bold text-foreground sm:text-xl">
                IELTS {mastery.cefr.ieltsBand} Equivalent
              </h2>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {mastery.cefr.description}
              </p>
            </div>
          </div>

          {/* Key Metrics Quick Highlights */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:col-span-7">
            <div className="rounded-xl border bg-background/50 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Flame className="size-3.5 text-amber-500" />
                <span>Streak</span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">
                {mastery.currentStreak}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  days
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                Best: {mastery.longestStreak} days
              </p>
            </div>

            <div className="rounded-xl border bg-background/50 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Target className="size-3.5 text-emerald-500" />
                <span>Accuracy</span>
              </div>
              <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {mastery.overallAccuracy}%
              </p>
              <p className="text-[10px] text-muted-foreground">
                {mastery.totalQuestionsAnswered} answered
              </p>
            </div>

            <div className="rounded-xl border bg-background/50 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="size-3.5 text-primary" />
                <span>Sessions</span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">
                {mastery.totalSessionsCompleted}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {mastery.activeDaysCount} active days
              </p>
            </div>

            <div className="rounded-xl border bg-background/50 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="size-3.5 text-blue-500" />
                <span>Learned</span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">
                {vocab.statusCounts.learned +
                  synonyms.statusCounts.learned +
                  grammar.topicsLearned}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Items mastered
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TABBED CONTROLS */}
      <div className="flex items-center gap-2 overflow-x-auto border-b pb-2 text-sm">
        {(
          [
            {
              key: "overview",
              label: "Overview & Recommendations",
              icon: Sparkles,
            },
            { key: "vocabulary", label: "Vocabulary Mastery", icon: BookOpen },
            { key: "synonyms", label: "Synonym Clusters", icon: Layers },
            { key: "grammar", label: "Grammar & Accuracy", icon: TrendingUp },
            { key: "activity", label: "30-Day Activity", icon: Calendar },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-8 animate-in fade-in-50 duration-300">
          {/* Smart Recommendations */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Tailored Recommendations
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((rec) => (
                <Card
                  key={rec.id}
                  className="flex flex-col justify-between p-4 space-y-3 transition-colors hover:border-primary/40"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          rec.type === "ACTION"
                            ? "bg-primary/10 text-primary"
                            : rec.type === "FOCUS"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {rec.type}
                      </span>
                      {rec.metric && (
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {rec.metric}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-foreground">
                      {rec.title}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {rec.description}
                    </p>
                  </div>

                  {rec.actionHref && rec.actionLabel && (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                    >
                      <Link href={rec.actionHref}>
                        {rec.actionLabel} <ArrowRight className="size-3 ml-1" />
                      </Link>
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* Module Performance Cards Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Vocabulary Pillar */}
            <Card className="p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <BookOpen className="size-4" /> Vocabulary Pillar
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {vocab.retentionRate}% retention
                  </span>
                </div>
                <h3 className="text-2xl font-black text-foreground">
                  {vocab.totalWords}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    words
                  </span>
                </h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Learned:</span>
                    <span className="font-semibold text-foreground">
                      {vocab.statusCounts.learned}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Due for review:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {vocab.dueCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Added this week:</span>
                    <span className="font-semibold text-foreground">
                      +{vocab.addedThisWeekCount}
                    </span>
                  </div>
                </div>
              </div>

              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/learn">Review Vocabulary</Link>
              </Button>
            </Card>

            {/* Synonyms Pillar */}
            <Card className="p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Layers className="size-4" /> Synonyms Pillar
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {synonyms.recallAccuracy}% recall
                  </span>
                </div>
                <h3 className="text-2xl font-black text-foreground">
                  {synonyms.totalSynonyms}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    synonyms ({synonyms.totalGroups} groups)
                  </span>
                </h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Learned groups:</span>
                    <span className="font-semibold text-foreground">
                      {synonyms.statusCounts.learned}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Due for review:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {synonyms.dueCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg depth per group:</span>
                    <span className="font-semibold text-foreground">
                      {synonyms.avgSynonymsPerGroup} words
                    </span>
                  </div>
                </div>
              </div>

              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/learn/synonyms">Practice Synonyms</Link>
              </Button>
            </Card>

            {/* Grammar Pillar */}
            <Card className="p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <TrendingUp className="size-4" /> Grammar Pillar
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {grammar.overallAccuracy}% accuracy
                  </span>
                </div>
                <h3 className="text-2xl font-black text-foreground">
                  {grammar.totalTopics}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    topics ({grammar.coveragePercent}% practiced)
                  </span>
                </h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Learned topics:</span>
                    <span className="font-semibold text-foreground">
                      {grammar.topicsLearned}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exercises attempted:</span>
                    <span className="font-semibold text-foreground">
                      {grammar.totalAttempts}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Challenging topics:</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {grammar.challengingTopics.length}
                    </span>
                  </div>
                </div>
              </div>

              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/learn/grammar">Practice Grammar</Link>
              </Button>
            </Card>
          </div>

          {/* Quick Heatmap Strip Preview */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Recent 30-Day Activity
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setActiveTab("activity")}
              >
                Full Activity Grid <ArrowRight className="size-3 ml-1" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {activity30Days.map((item) => (
                <div
                  key={item.date}
                  title={`${item.date}: ${item.completedSessions} sessions, ${item.questionsAnswered} questions`}
                  className={`size-5 rounded-xs transition-all hover:scale-125 ${
                    item.intensity === 0
                      ? "bg-muted"
                      : item.intensity === 1
                        ? "bg-primary/30"
                        : item.intensity === 2
                          ? "bg-primary/50"
                          : item.intensity === 3
                            ? "bg-primary/75"
                            : "bg-primary shadow-xs shadow-primary/50"
                  }`}
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: VOCABULARY */}
      {activeTab === "vocabulary" && (
        <div className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Total Words</p>
              <p className="text-3xl font-black text-foreground">
                {vocab.totalWords}
              </p>
              <p className="text-[11px] text-muted-foreground">
                +{vocab.addedThisWeekCount} added this week
              </p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Retention Rate</p>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {vocab.retentionRate}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {vocab.correctAttempts} / {vocab.totalAttempts} attempts
              </p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Due For Review</p>
              <p className="text-3xl font-black text-amber-600 dark:text-amber-400">
                {vocab.dueCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Spaced repetition review
              </p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Mature Memories</p>
              <p className="text-3xl font-black text-primary">
                {vocab.intervalStages.matureCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Interval &gt; 14 days
              </p>
            </Card>
          </div>

          {/* Status Breakdown & Maturity Distribution */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Status Breakdown */}
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Notebook Status Breakdown
              </h3>

              <div className="space-y-3">
                {[
                  {
                    label: "Learned Words",
                    count: vocab.statusCounts.learned,
                    color: "bg-emerald-500",
                    textColor: "text-emerald-600 dark:text-emerald-400",
                  },
                  {
                    label: "In Learning",
                    count: vocab.statusCounts.learning,
                    color: "bg-blue-500",
                    textColor: "text-blue-600 dark:text-blue-400",
                  },
                  {
                    label: "Needs Reinforcement (Difficult)",
                    count: vocab.statusCounts.difficult,
                    color: "bg-amber-500",
                    textColor: "text-amber-600 dark:text-amber-400",
                  },
                  {
                    label: "New Words (Unattempted)",
                    count: vocab.statusCounts.new,
                    color: "bg-muted-foreground",
                    textColor: "text-muted-foreground",
                  },
                ].map((item) => {
                  const pct =
                    vocab.totalWords > 0
                      ? Math.round((item.count / vocab.totalWords) * 100)
                      : 0;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-foreground">
                          {item.label}
                        </span>
                        <span className={`font-bold ${item.textColor}`}>
                          {item.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${item.color} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Spaced Repetition Maturity Stages */}
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Spaced Repetition Memory Stages
              </h3>

              <div className="space-y-4">
                <div className="rounded-xl border p-3.5 space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-foreground">
                      🌱 Learning Stage (1–3 Days)
                    </span>
                    <span className="text-primary font-bold">
                      {vocab.intervalStages.learningCount} words
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Words in active repetition. Reviewing frequently builds
                    strong synaptic connections.
                  </p>
                </div>

                <div className="rounded-xl border p-3.5 space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-foreground">
                      🌿 Maturing Stage (4–14 Days)
                    </span>
                    <span className="text-blue-500 font-bold">
                      {vocab.intervalStages.maturingCount} words
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Words successfully recalled multiple times. Intervals are
                    expanding.
                  </p>
                </div>

                <div className="rounded-xl border p-3.5 space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-foreground">
                      🌳 Mature & Long-Term (15+ Days)
                    </span>
                    <span className="text-emerald-500 font-bold">
                      {vocab.intervalStages.matureCount} words
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Stable, internalized vocabulary with durable recall
                    capacity.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: SYNONYMS */}
      {activeTab === "synonyms" && (
        <div className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Synonym Groups</p>
              <p className="text-3xl font-black text-foreground">
                {synonyms.totalGroups}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Expression clusters
              </p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Total Synonyms</p>
              <p className="text-3xl font-black text-primary">
                {synonyms.totalSynonyms}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Individual words & phrases
              </p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Average Depth</p>
              <p className="text-3xl font-black text-foreground">
                {synonyms.avgSynonymsPerGroup}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Synonyms per cluster
              </p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Recall Accuracy</p>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {synonyms.recallAccuracy}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {synonyms.correctAttempts} / {synonyms.totalAttempts} attempts
              </p>
            </Card>
          </div>

          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Synonym Group Status Breakdown
            </h3>

            <div className="space-y-3">
              {[
                {
                  label: "Learned Groups",
                  count: synonyms.statusCounts.learned,
                  color: "bg-emerald-500",
                  textColor: "text-emerald-600 dark:text-emerald-400",
                },
                {
                  label: "Learning Groups",
                  count: synonyms.statusCounts.learning,
                  color: "bg-blue-500",
                  textColor: "text-blue-600 dark:text-blue-400",
                },
                {
                  label: "Difficult Groups",
                  count: synonyms.statusCounts.difficult,
                  color: "bg-amber-500",
                  textColor: "text-amber-600 dark:text-amber-400",
                },
                {
                  label: "New Groups",
                  count: synonyms.statusCounts.new,
                  color: "bg-muted-foreground",
                  textColor: "text-muted-foreground",
                },
              ].map((item) => {
                const pct =
                  synonyms.totalGroups > 0
                    ? Math.round((item.count / synonyms.totalGroups) * 100)
                    : 0;
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {item.label}
                      </span>
                      <span className={`font-bold ${item.textColor}`}>
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${item.color} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: GRAMMAR */}
      {activeTab === "grammar" && (
        <div className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Grammar Accuracy</p>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {grammar.overallAccuracy}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {grammar.correctAttempts} / {grammar.totalAttempts} exercises
              </p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Topic Coverage</p>
              <p className="text-3xl font-black text-primary">
                {grammar.coveragePercent}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {grammar.topicsPracticed} / {grammar.totalTopics} topics
              </p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Learned Topics</p>
              <p className="text-3xl font-black text-foreground">
                {grammar.topicsLearned}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Mastered rules
              </p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">
                Challenging Topics
              </p>
              <p className="text-3xl font-black text-rose-600 dark:text-rose-400">
                {grammar.challengingTopics.length}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Accuracy &lt; 75%
              </p>
            </Card>
          </div>

          {/* Grammar Categories Breakdown */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Mastery by Grammar Category
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              {grammar.categoryBreakdown.map((cat) => (
                <div
                  key={cat.category}
                  className="rounded-xl border p-3.5 space-y-2 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      {cat.label}
                    </span>
                    <span className="text-xs font-bold text-primary">
                      {cat.attemptsCount > 0 ? `${cat.accuracy}%` : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${cat.accuracy}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{cat.topicCount} topics</span>
                    <span>{cat.attemptsCount} attempts</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Exercise Types Performance */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Performance by Exercise Type
            </h3>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grammar.exerciseTypeBreakdown.map((item) => (
                <div
                  key={item.exerciseType}
                  className="rounded-xl border p-3.5 space-y-1.5"
                >
                  <p className="text-xs font-semibold text-foreground">
                    {item.label}
                  </p>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {item.attemptsCount > 0 ? `${item.accuracy}%` : "—"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {item.correctCount} / {item.attemptsCount} correct
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Challenging Topics list */}
          {grammar.challengingTopics.length > 0 && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Topics That Need Extra Attention
                  </h3>
                </div>
              </div>

              <div className="divide-y rounded-xl border">
                {grammar.challengingTopics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <GrammarCategoryBadge category={topic.category} />
                        <GrammarStatusBadge
                          status={topic.status as GrammarStatus}
                        />
                      </div>
                      <p className="text-sm font-bold text-foreground">
                        {topic.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right text-xs">
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {topic.accuracy}%
                        </span>{" "}
                        <span className="text-muted-foreground">accuracy</span>
                        <p className="text-[10px] text-muted-foreground">
                          {topic.mistakesCount} mistakes
                        </p>
                      </div>

                      <Button asChild size="sm" variant="outline">
                        <Link href={`/learn/grammar/${topic.id}`}>
                          Practice
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 5: ACTIVITY */}
      {activeTab === "activity" && (
        <div className="space-y-6 animate-in fade-in-50 duration-300">
          <Card className="p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-foreground">
                30-Day Daily Study Habit
              </h3>
              <p className="text-xs text-muted-foreground">
                Each square represents one calendar day. Darker colors indicate
                higher study volume.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {activity30Days.map((item) => (
                <div
                  key={item.date}
                  className="flex flex-col items-center gap-1 group relative cursor-pointer"
                >
                  <div
                    className={`size-8 rounded-lg border flex items-center justify-center text-[10px] font-semibold transition-all group-hover:scale-115 ${
                      item.intensity === 0
                        ? "bg-muted/60 text-muted-foreground border-transparent"
                        : item.intensity === 1
                          ? "bg-primary/20 text-foreground border-primary/30"
                          : item.intensity === 2
                            ? "bg-primary/40 text-foreground border-primary/50"
                            : item.intensity === 3
                              ? "bg-primary/70 text-primary-foreground border-primary/80"
                              : "bg-primary text-primary-foreground border-primary font-bold shadow-xs shadow-primary/50"
                    }`}
                  >
                    {item.dayOfMonth}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {item.displayDay}
                  </span>

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-20">
                    <div className="rounded-md bg-popover px-2.5 py-1 text-[11px] font-medium text-popover-foreground shadow-md border whitespace-nowrap">
                      <p className="font-bold">{item.date}</p>
                      <p className="text-muted-foreground">
                        {item.completedSessions} sessions ·{" "}
                        {item.questionsAnswered} questions
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Intensity Legend */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-4 border-t">
              <span>Less active</span>
              <div className="size-3 rounded-xs bg-muted" />
              <div className="size-3 rounded-xs bg-primary/20" />
              <div className="size-3 rounded-xs bg-primary/40" />
              <div className="size-3 rounded-xs bg-primary/70" />
              <div className="size-3 rounded-xs bg-primary" />
              <span>More active</span>
            </div>
          </Card>

          {/* Module distribution of completed sessions */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="size-3.5 text-primary" />
                <span>Vocabulary Sessions</span>
              </div>
              <p className="text-2xl font-black text-foreground">
                {mastery.moduleSessionCounts.vocabulary}
              </p>
            </Card>

            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers className="size-3.5 text-primary" />
                <span>Synonym Sessions</span>
              </div>
              <p className="text-2xl font-black text-foreground">
                {mastery.moduleSessionCounts.synonyms}
              </p>
            </Card>

            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="size-3.5 text-primary" />
                <span>Grammar Sessions</span>
              </div>
              <p className="text-2xl font-black text-foreground">
                {mastery.moduleSessionCounts.grammar}
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
