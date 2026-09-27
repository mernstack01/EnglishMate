import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getProgressAnalytics } from "@/services/progress";
import { ProgressDashboard } from "@/features/progress/components/progress-dashboard";

export const metadata: Metadata = {
  title: "Learning Progress & Analytics",
  description:
    "Comprehensive mastery analytics across vocabulary, synonyms, and grammar",
};

export default async function ProgressPage() {
  await requireUser();
  const analytics = await getProgressAnalytics();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Mastery & Analytics
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
          Learning Progress
          <span className="text-primary">.</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Comprehensive analytics covering vocabulary retention, synonym depth,
          grammar accuracy, and study streaks.
        </p>
      </div>

      {/* Main Interactive Dashboard */}
      <ProgressDashboard data={analytics} />
    </div>
  );
}
