import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { modules } from "./module-catalog";
export function ModuleEmptyState({ module }: { module: keyof typeof modules }) {
  const { title, eyebrow, description, icon: Icon, items } = modules[module];
  return (
    <div className="mx-auto max-w-3xl pt-4">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">
        {eyebrow}
      </p>
      <Card className="mt-6 px-6 py-12 text-center sm:px-14 sm:py-16">
        <span className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-secondary text-primary">
          <Icon className="size-9" strokeWidth={1.5} />
        </span>
        <p className="mt-7 text-xs font-semibold tracking-widest text-primary">
          GROWING SOON
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
          {description}
        </p>
        <ul className="mx-auto my-8 w-fit space-y-3 text-left">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm">
              <Check className="size-4 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mb-6 text-xs text-muted-foreground">
          This feature is on its way. Your personal space is ready.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">
            <ArrowLeft />
            Back to dashboard
          </Link>
        </Button>
      </Card>
    </div>
  );
}
