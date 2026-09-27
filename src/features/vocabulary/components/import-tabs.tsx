"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileJson, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImportTabs() {
  const pathname = usePathname();
  const isImageImport = pathname === "/vocabulary/import/image";

  return (
    <div className="flex gap-2 border-b pb-4">
      <Link
        href="/vocabulary/import"
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
          !isImageImport
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <FileJson className="size-4" />
        Import JSON
      </Link>
      <Link
        href="/vocabulary/import/image"
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
          isImageImport
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Sparkles className="size-4 text-amber-500" />
        Import from Image
      </Link>
    </div>
  );
}
