"use client";
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
  const mobile = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    items[1],
    items[2],
    items[4],
    { href: "/settings", label: "Profile", icon: UserRound },
  ];
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 px-1 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
    >
      {mobile.map(({ href, label, icon: Icon }) => (
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
    </nav>
  );
}
