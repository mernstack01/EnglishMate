import Link from "next/link";
import type { Metadata } from "next";
import { LogOut, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { SettingsForm } from "@/components/forms/settings-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/actions";
export const metadata: Metadata = { title: "Settings" };
export default async function Settings() {
  const user = await requireUser();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Make yourself at home.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your profile, your preferences, your learning space.
        </p>
      </div>
      <Card className="p-6 sm:p-8">
        <h2 className="mb-6 text-lg font-semibold">Personal details</h2>
        <SettingsForm user={user} />
      </Card>
      <Card className="flex items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-semibold">Light or dark, your choice.</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your theme is remembered on this device.
          </p>
        </div>
        <ThemeToggle />
      </Card>
      {user.role === "ADMIN" && (
        <Button asChild variant="outline">
          <Link href="/admin">
            <ShieldCheck />
            Open administration
          </Link>
        </Button>
      )}
      <form action={logoutAction}>
        <Button variant="outline">
          <LogOut />
          Sign out
        </Button>
      </form>
    </div>
  );
}
