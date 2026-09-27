import { z } from "zod";
import { sessionTypes } from "@/models/study-session";

export const startSessionSchema = z.object({
  type: z.enum(sessionTypes).default("DAILY"),
});

export const submitAnswerSchema = z.object({
  sessionId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid session ID"),
  questionIndex: z.number().int().min(0).max(100),
  userAnswer: z.string().trim().max(1000),
  rating: z.enum(["AGAIN", "HARD", "GOOD", "EASY"]).optional(),
});

export const completeSessionSchema = z.object({
  sessionId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid session ID"),
});
