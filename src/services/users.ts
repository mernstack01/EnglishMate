import "server-only";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/user";
import { requireUser, requireAdmin } from "@/lib/auth/current-user";
import { hashPassword } from "@/lib/auth/password";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import {
  registerSchema,
  settingsSchema,
  usersQuerySchema,
  activationSchema,
} from "@/validations/auth";
export async function registerUser(input: unknown) {
  const data = registerSchema.parse(input);
  await connectDB();
  if (
    !(await consumeRateLimit(`register:${data.email}`, 5)) ||
    !(await consumeRateLimit("register:global", 100))
  )
    throw new Error("Please wait before trying to register again.");
  // Database unique index is the authority, including simultaneous registrations.
  await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(data.password),
    role: "USER",
    isActive: true,
  });
}
export async function updateProfile(input: unknown) {
  const currentUser = await requireUser();
  const data = settingsSchema.parse(input);
  await connectDB();
  await User.updateOne(
    { _id: currentUser.id, isActive: true },
    { $set: data },
    { runValidators: true },
  );
}
export async function getAdminStats() {
  await requireAdmin();
  await connectDB();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [total, active, recent] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ createdAt: { $gte: since } }),
  ]);
  return { total, active, recent };
}
export async function listUsers(input: unknown) {
  await requireAdmin();
  await connectDB();
  const { q, status, page } = usersQuerySchema.parse(input);
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = {
    ...(status !== "all" ? { isActive: status === "active" } : {}),
    ...(q
      ? {
          $or: [
            { name: { $regex: escaped, $options: "i" } },
            { email: { $regex: escaped, $options: "i" } },
          ],
        }
      : {}),
  };
  const total = await User.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / 10));
  const currentPage = Math.min(page, pages);
  const users = await User.find(filter)
    .select("name email role isActive createdAt")
    .sort({ createdAt: -1, _id: -1 })
    .skip((currentPage - 1) * 10)
    .limit(10)
    .lean();
  return {
    users: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
    })),
    total,
    pages,
    page: currentPage,
  };
}
export async function setUserActive(input: unknown) {
  const actor = await requireAdmin();
  const { id, isActive } = activationSchema.parse(input);
  if (id === actor.id && !isActive)
    throw new Error("You cannot deactivate your own account.");
  await connectDB();
  const result = await User.updateOne(
    { _id: id },
    { $set: { isActive } },
    { runValidators: true },
  );
  if (!result.matchedCount) throw new Error("User not found.");
}
