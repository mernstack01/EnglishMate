"use client";

import { useTransition } from "react";
import {
  startGrammarTopicPracticeAction,
  startGrammarMistakesPracticeAction,
} from "@/features/learning/grammar-actions";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";

interface StartGrammarPracticeButtonProps {
  topicId?: string;
  isMistakes?: boolean;
  label?: string;
  ariaLabel?: string;
  className?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

export function StartGrammarPracticeButton({
  topicId,
  isMistakes = false,
  label,
  ariaLabel,
  className,
  variant = "default",
  size = "default",
}: StartGrammarPracticeButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleStart = () => {
    startTransition(async () => {
      if (isMistakes) {
        await startGrammarMistakesPracticeAction(topicId);
      } else if (topicId) {
        await startGrammarTopicPracticeAction(topicId);
      }
    });
  };

  const defaultLabel = isMistakes
    ? "Practice Grammar Mistakes"
    : "Start Practice";

  return (
    <Button
      variant={variant}
      size={size}
      disabled={isPending}
      onClick={handleStart}
      aria-label={ariaLabel}
      className={className}
    >
      {isPending ? (
        <>
          <Loader2 className="size-4 animate-spin mr-2" />
          Preparing session...
        </>
      ) : (
        <>
          <Play className="size-4 mr-1.5" />
          {label || defaultLabel}
        </>
      )}
    </Button>
  );
}
