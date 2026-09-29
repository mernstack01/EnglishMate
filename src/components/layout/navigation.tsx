"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Play,
  BookOpen,
  Layers,
  PenLine,
  CircleAlert,
  ChartNoAxesCombined,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/learn", label: "Learn", icon: Play },
  { href: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { href: "/synonyms", label: "Synonyms", icon: Layers },
  { href: "/grammar", label: "Grammar", icon: PenLine },
  { href: "/mistakes", label: "Mistakes", icon: CircleAlert },
  { href: "/progress", label: "Progress", icon: ChartNoAxesCombined },
];
export function DesktopNavigation({ admin }: { admin: boolean }) {
  const path = usePathname();
  const links = [
    ...items,
    { href: "/settings", label: "Settings", icon: Settings },
    ...(admin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];
  return (
    <nav aria-label="Main navigation" className="space-y-1.5">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          path === href ||
          ((href === "/admin" ||
            href === "/vocabulary" ||
            href === "/synonyms" ||
            href === "/grammar" ||
            href === "/learn") &&
            path.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              href === "/settings" && "mt-8",
            )}
          >
            <Icon className="size-[19px]" />
            {label}
            {active && (
              <span className="ml-auto size-1.5 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
export function MobileNavigation() {
  const path = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const mobilePrimary = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/learn", label: "Learn", icon: Play },
    { href: "/mistakes", label: "Mistakes", icon: CircleAlert },
    { href: "/progress", label: "Progress", icon: ChartNoAxesCombined },
  ];

  const moreItems = [
    { href: "/vocabulary", label: "Vocabulary Notebook", icon: BookOpen },
    { href: "/synonyms", label: "Synonym Clusters", icon: Layers },
    { href: "/grammar", label: "Grammar Notebook", icon: PenLine },
    { href: "/settings", label: "Profile & Settings", icon: Settings },
  ];

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="fixed inset-x-0 bottom-16 z-50 rounded-t-2xl border-t bg-card p-4 shadow-xl space-y-2 animate-in slide-in-from-bottom-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                More Destinations
              </span>
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={() => setMoreOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {moreItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border p-3 text-xs font-medium transition-colors",
                    path.startsWith(href)
                      ? "bg-secondary text-primary border-primary/30"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 px-1 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
      >
        {mobilePrimary.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={
              path === href || path.startsWith(`${href}/`) ? "page" : undefined
            }
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium",
              path === href || path.startsWith(`${href}/`)
                ? "text-primary bg-secondary"
                : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}

        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className={cn(
            "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium",
            moreOpen || moreItems.some((item) => path.startsWith(item.href))
              ? "text-primary bg-secondary"
              : "text-muted-foreground",
          )}
        >
          <UserRound className="size-5" />
          More
        </button>
      </nav>
    </>
  );
}
