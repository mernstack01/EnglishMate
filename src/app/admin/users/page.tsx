import Link from "next/link";
import type { Metadata } from "next";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { listUsers } from "@/services/users";
import { requireAdmin } from "@/lib/auth/current-user";
import { usersQuerySchema } from "@/validations/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ActivationForm } from "@/components/forms/activation-form";
export const metadata: Metadata = { title: "Manage users" };
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const parsed = usersQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : usersQuerySchema.parse({});
  const result = await listUsers(query);
  const pageUrl = (page: number) =>
    `/admin/users?${new URLSearchParams({ q: query.q, status: query.status, page: String(page) })}`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Your community.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage accounts and help everyone keep moving forward.
        </p>
      </div>
      <Card className="overflow-hidden">
        <form action="/admin/users" className="grid gap-3 border-b p-5 sm:flex">
          <div className="flex-1">
            <label htmlFor="q" className="sr-only">
              Search users by name or email
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={query.q}
              placeholder="Search by name or email…"
              maxLength={100}
            />
          </div>
          <label htmlFor="status" className="sr-only">
            Account status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={query.status}
            className="min-h-12 rounded-xl border bg-background px-3 text-sm"
          >
            <option value="all">All accounts</option>
            <option value="active">Active accounts</option>
            <option value="inactive">Inactive accounts</option>
          </select>
          <Button type="submit">
            <Search />
            Search
          </Button>
        </form>
        {!parsed.success && (
          <p role="alert" className="px-5 pt-4 text-sm text-destructive">
            Invalid search parameters. Showing all accounts.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {["Member", "Role", "Status", "Joined", "Access"].map((t) => (
                  <th key={t} scope="col" className="px-5 py-4 font-medium">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-5">
                    <p className="max-w-64 truncate font-semibold">
                      {user.name}
                    </p>
                    <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </td>
                  <td className="px-5 py-5 text-xs">
                    {user.role === "ADMIN" ? "Admin" : "Learner"}
                  </td>
                  <td className="px-5 py-5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.isActive ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-5 text-xs text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </td>
                  <td className="px-5 py-5">
                    <ActivationForm
                      id={user.id}
                      isActive={user.isActive}
                      self={user.id === actor.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!result.users.length && (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold">No matching members.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try another name or change the account filter.
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t p-5">
          <p className="text-xs text-muted-foreground">
            {result.total} {result.total === 1 ? "member" : "members"} · Page{" "}
            {result.page} of {result.pages}
          </p>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageUrl(result.page - 1)}>
                  <ChevronLeft />
                  Previous
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft />
                Previous
              </Button>
            )}
            {result.page < result.pages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageUrl(result.page + 1)}>
                  Next
                  <ChevronRight />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next
                <ChevronRight />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
