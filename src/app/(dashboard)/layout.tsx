import { requireUser } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";
export const runtime = "nodejs";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
