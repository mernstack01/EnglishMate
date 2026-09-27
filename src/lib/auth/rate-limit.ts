import { createHash } from "node:crypto";
import { connectDB } from "@/lib/db/connect";
import { RateLimit } from "@/models/rate-limit";
// Atomic fixed windows shared by all application instances; no in-memory-only limiter.
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs = 15 * 60 * 1000,
) {
  await connectDB();
  const window = Math.floor(Date.now() / windowMs);
  const id = createHash("sha256").update(`${key}:${window}`).digest("hex");
  let record;
  try {
    record = await RateLimit.findOneAndUpdate(
      { _id: id },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((window + 1) * windowMs) },
      },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ))
      throw error;
    record = await RateLimit.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 } },
      { returnDocument: "after" },
    );
  }
  return !!record && record.count <= limit;
}
