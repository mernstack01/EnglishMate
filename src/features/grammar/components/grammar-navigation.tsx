"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenLine, Sun, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export function GrammarNavigation() {
  const path = usePathname();

  return (
    <nav
      aria-label="Grammar navigation"
      className="flex gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5"
    >
      {[
        { href: "/grammar", label: "All topics", icon: PenLine },
        { href: "/grammar/today", label: "Today", icon: Sun },
        { href: "/grammar/new", label: "Add topic", icon: Plus },
        { href: "/grammar/import", label: "Import", icon: Upload },
      ].map(({ href, label, icon: Icon }) => {
        const isActive =
          path === href ||
          (href === "/grammar/import" && path.startsWith("/grammar/import"));

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition-colors sm:flex-1 sm:text-sm",
              isActive
                ? "bg-secondary text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
