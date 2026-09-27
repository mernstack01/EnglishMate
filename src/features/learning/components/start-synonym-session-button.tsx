"use client";

import { useTransition } from "react";
import { startSynonymSessionAction } from "@/features/learning/synonym-actions";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";

interface StartSynonymSessionButtonProps {
  type?: "DAILY" | "DUE" | "NEW" | "DIFFICULT";
  label?: string;
  className?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

export function StartSynonymSessionButton({
  type = "DAILY",
  label = "Start Synonym Practice",
  className,
  variant = "default",
  size = "default",
}: StartSynonymSessionButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleStart = () => {
    startTransition(async () => {
      await startSynonymSessionAction(type);
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={isPending}
      onClick={handleStart}
      className={className}
    >
      {isPending ? (
        <>
          <Loader2 className="size-4 animate-spin mr-2" />
          Preparing session...
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="size-4 ml-1.5" />
        </>
      )}
    </Button>
  );
}
