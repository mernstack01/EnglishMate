import Link from "next/link";
import { LogOut, ChevronRight, Sprout } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { DesktopNavigation, MobileNavigation } from "./navigation";
import { logoutAction } from "@/app/actions";
import type { CurrentUser } from "@/types/user";
export function AppShell({
  user,
  children,
  admin = false,
}: {
  user: CurrentUser;
  children: React.ReactNode;
  admin?: boolean;
}) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only fixed top-2 left-2 z-50 rounded-lg bg-card p-3 focus:not-sr-only"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col overflow-y-auto border-r bg-card px-5 py-8 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <p className="mt-10 mb-4 px-4 text-[10px] font-semibold tracking-[.16em] text-muted-foreground">
          YOUR LEARNING SPACE
        </p>
        <DesktopNavigation admin={user.role === "ADMIN"} />
        <div className="mt-auto pt-8">
          <div className="rounded-2xl bg-secondary p-4">
            <Sprout className="mb-3 size-6 text-primary" />
            <p className="text-sm font-semibold">A little, every day.</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Small steps today.
              <br />
              More confidence tomorrow.
            </p>
          </div>
          <form action={logoutAction} className="mt-5">
            <Button variant="ghost" className="w-full justify-start">
              <LogOut /> Sign out
            </Button>
          </form>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="flex h-20 items-center justify-between gap-3 border-b bg-card px-5 sm:px-9">
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="hidden items-center gap-2 text-sm lg:flex">
            <span className="text-muted-foreground">My workspace</span>
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <span className="font-medium">
              {admin ? "Administration" : "Let’s grow together"}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <span className="hidden h-6 w-px bg-border sm:block" />
            <Link
              href="/settings"
              aria-label="Your profile"
              className="flex items-center gap-3"
            >
              <span className="hidden text-right sm:block">
                <span className="block max-w-36 truncate text-sm font-semibold">
                  {user.name}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {user.role === "ADMIN" ? "Administrator" : "English learner"}
                </span>
              </span>
              <span className="flex size-10 items-center justify-center rounded-full border border-primary/10 bg-secondary text-sm font-bold text-primary">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            </Link>
          </div>
        </header>
        <main
          id="main"
          className="page-enter mx-auto max-w-7xl px-5 pt-7 pb-28 sm:px-9 sm:pt-10 lg:pb-12"
        >
          {children}
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}
