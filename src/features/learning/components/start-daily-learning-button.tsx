"use client";

import { useTransition } from "react";
import { ArrowRight, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startDailySessionAction } from "../daily-actions";

interface StartDailyLearningButtonProps {
  label?: string;
  isActive?: boolean;
  progressText?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
}

export function StartDailyLearningButton({
  label,
  isActive = false,
  progressText,
  className,
  size = "lg",
  variant = "default",
}: StartDailyLearningButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await startDailySessionAction();
    });
  };

  const buttonText =
    label ||
    (isActive && progressText
      ? `Continue — ${progressText}`
      : isActive
        ? "Continue Today's Learning"
        : "Start Today's Learning");

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={isPending}
      onClick={handleClick}
    >
      {isActive ? (
        <RotateCcw className="mr-2 size-4" />
      ) : (
        <Play className="mr-2 size-4 fill-current" />
      )}
      {isPending ? "Starting…" : buttonText}
      {!isPending && <ArrowRight className="ml-2 size-4" />}
    </Button>
  );
}
