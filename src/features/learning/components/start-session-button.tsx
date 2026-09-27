"use client";

import { useTransition } from "react";
import { startLearningAction } from "@/features/learning/actions";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";

interface StartSessionButtonProps {
  type?: "DAILY" | "DUE" | "NEW" | "DIFFICULT";
  label?: string;
  className?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

export function StartSessionButton({
  type = "DAILY",
  label = "Start Learning",
  className,
  variant = "default",
  size = "default",
}: StartSessionButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleStart = () => {
    startTransition(async () => {
      await startLearningAction(type);
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
