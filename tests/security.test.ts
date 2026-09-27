import test from "node:test";
import assert from "node:assert/strict";
import {
  registerSchema,
  settingsSchema,
  usersQuerySchema,
  activationSchema,
} from "../src/validations/auth";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
test("registration normalizes email and strips client privileges", () => {
  const user = registerSchema.parse({
    name: "  Alice  ",
    email: "Alice@EXAMPLE.COM",
    password: "a-long-secret-phrase",
    role: "ADMIN",
    isActive: true,
    userId: "other",
  });
  assert.deepEqual(Object.keys(user).sort(), ["email", "name", "password"]);
  assert.equal(user.name, "Alice");
  assert.equal(user.email, "alice@example.com");
});
test("operator injection and bcrypt truncation are rejected", () => {
  assert.equal(
    registerSchema.safeParse({
      name: "Alice",
      email: { $ne: null },
      password: "long-secret-phrase",
    }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({
      name: "Alice",
      email: "alice@example.com",
      password: "😀".repeat(20),
    }).success,
    false,
  );
  assert.equal(
    activationSchema.safeParse({ id: { $ne: null }, isActive: false }).success,
    false,
  );
  assert.equal(usersQuerySchema.safeParse({ page: -1 }).success, false);
});
test("settings cannot mutate role, status or identity", () => {
  assert.deepEqual(
    settingsSchema.parse({
      name: "Alice",
      preferredLanguage: "UZ",
      role: "ADMIN",
      email: "changed@example.com",
      isActive: true,
    }),
    { name: "Alice", preferredLanguage: "UZ" },
  );
});
test("passwords are salted and only correct secrets verify", async () => {
  const password = "a-long-secret-phrase";
  const a = await hashPassword(password);
  const b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.notEqual(a, password);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword("wrong-password", a), false);
  assert.equal(await verifyPassword(password), false);
});
test("password length accepts 4 characters and rejects fewer", () => {
  assert.equal(
    registerSchema.safeParse({
      name: "Bob",
      email: "bob@example.com",
      password: "1234",
    }).success,
    true,
  );
  assert.equal(
    registerSchema.safeParse({
      name: "Bob",
      email: "bob@example.com",
      password: "123",
    }).success,
    false,
  );
});
