"use server";
import { AuthError } from "next-auth";
import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth/config";
import { registerUser, updateProfile, setUserActive } from "@/services/users";
import { requireAdmin, requireUser } from "@/lib/auth/current-user";
import {
  loginSchema,
  registerSchema,
  settingsSchema,
} from "@/validations/auth";
import type { ActionState } from "@/types/actions";
function validationError(error: ZodError): ActionState {
  return {
    error: "Check the highlighted fields.",
    fields: error.flatten().fieldErrors as Record<string, string[]>,
  };
}
export async function loginAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return validationError(parsed.error);
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError)
      return {
        error:
          "Unable to sign in. Check your credentials and account status, or try again later.",
      };
    throw error;
  }
  return {};
}
export async function registerAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return validationError(parsed.error);
  try {
    await registerUser(parsed.data);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    )
      return {
        error:
          "Unable to create an account with that email. Try signing in instead.",
      };
    return {
      error: "We couldn’t create your account. Please try again later.",
    };
  }
  redirect("/login?registered=1");
}
export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
export async function settingsAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return validationError(parsed.error);
  try {
    await updateProfile(parsed.data);
  } catch {
    return { error: "Your changes couldn’t be saved. Please try again." };
  }
  revalidatePath("/", "layout");
  return { success: "Your preferences are saved." };
}
export async function activationAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const active = form.get("isActive");
  if (active !== "true" && active !== "false")
    return { error: "Invalid account status." };
  try {
    await setUserActive({ id: form.get("id"), isActive: active === "true" });
  } catch (error) {
    return {
      error:
        error instanceof Error &&
        ["You cannot deactivate your own account.", "User not found."].includes(
          error.message,
        )
          ? error.message
          : "Unable to update this account.",
    };
  }
  revalidatePath("/admin", "layout");
  return {
    success: active === "true" ? "Account activated." : "Account deactivated.",
  };
}
