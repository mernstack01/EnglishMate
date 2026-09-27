import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db/connect";
import { VocabularyWord } from "../src/models/vocabulary-word";
import { User } from "../src/models/user";
import { RateLimit } from "../src/models/rate-limit";
import { registerSchema } from "../src/validations/auth";
import { hashPassword } from "../src/lib/auth/password";
loadEnvConfig(process.cwd());
async function main() {
  const data = registerSchema.parse({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  await connectDB();
  await Promise.all([
    User.createIndexes(),
    RateLimit.createIndexes(),
    VocabularyWord.createIndexes(),
  ]);
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    if (existing.role !== "ADMIN")
      throw new Error(
        "This email belongs to a regular user. Use a different admin email; the seed will not silently promote accounts.",
      );
    console.log("Admin already exists. Password and account status unchanged.");
    return;
  }
  await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(data.password),
    role: "ADMIN",
    isActive: true,
  });
  console.log("First admin created successfully.");
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Admin creation failed.",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
