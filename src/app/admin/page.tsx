import Link from "next/link";
import type { Metadata } from "next";
import {
  Users,
  UserCheck,
  UserPlus,
  ArrowRight,
  ChartNoAxesCombined,
} from "lucide-react";
import { getAdminStats } from "@/services/users";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = { title: "Administration" };
export default async function Admin() {
  const stats = await getAdminStats();
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-widest text-primary">
          BEHIND THE LEARNING
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          A growing community.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Look after the people who call EnglishMate their learning space.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total users",
            value: stats.total,
            icon: Users,
            caption: "Everyone in your community",
          },
          {
            label: "Active users",
            value: stats.active,
            icon: UserCheck,
            caption: "Accounts with access enabled",
          },
          {
            label: "New users",
            value: stats.recent,
            icon: UserPlus,
            caption: "Joined in the last 30 days",
          },
        ].map(({ label, value, icon: Icon, caption }) => (
          <Card key={label} className="p-6">
            <Icon className="size-6 text-primary" />
            <p className="mt-5 text-3xl font-semibold">{value}</p>
            <h2 className="mt-1 text-sm font-semibold">{label}</h2>
            <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
          </Card>
        ))}
      </div>
      <Card className="flex flex-wrap items-center justify-between gap-5 p-6">
        <div>
          <h2 className="font-semibold">People, all in one place.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Find members and manage account access.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users">
            Manage users
            <ArrowRight />
          </Link>
        </Button>
      </Card>
      <div className="flex items-center gap-3 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
        <ChartNoAxesCombined className="size-5 shrink-0" />
        Platform learning statistics will appear here as learning modules
        launch.
      </div>
    </div>
  );
}
