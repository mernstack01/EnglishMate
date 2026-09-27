import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";
export const runtime = "nodejs";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <AppShell user={user} admin>
      <nav aria-label="Administration" className="mb-7 flex gap-2">
        <Link
          href="/admin"
          className="rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:bg-muted"
        >
          Overview
        </Link>
        <Link
          href="/admin/users"
          className="rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:bg-muted"
        >
          Manage users
        </Link>
      </nav>
      {children}
    </AppShell>
  );
}
