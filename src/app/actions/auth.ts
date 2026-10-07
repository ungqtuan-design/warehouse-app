"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormActionState } from "@/lib/action-state";
import { clearSession, clearSessionCookies, createSession, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { uiText as text } from "@/lib/ui";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, text.currentPasswordRequired),
  newPassword: z.string().min(8, text.newPasswordTooShort),
  confirmPassword: z.string(),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: text.passwordConfirmationMismatch,
}).refine((value) => value.newPassword !== value.currentPassword, {
  message: text.passwordMustDiffer,
});

export async function changePasswordAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const currentUser = await requireUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? text.passwordChangeError;
    const validationMessages: string[] = [text.currentPasswordRequired, text.newPasswordTooShort,
      text.passwordConfirmationMismatch, text.passwordMustDiffer];
    return { status: "error", message: validationMessages.includes(message) ? message : text.passwordChangeError };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { passwordHash: true },
    });
    if (!user || !verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
      return { status: "error", message: text.currentPasswordIncorrect };
    }

    // The nested write is atomic; the hash guard prevents overwriting a concurrent reset.
    await prisma.user.update({
      where: { id: currentUser.id, passwordHash: user.passwordHash },
      data: {
        passwordHash: hashPassword(parsed.data.newPassword),
        sessions: { deleteMany: {} },
      },
      select: { id: true },
    });
  } catch {
    return { status: "error", message: text.passwordChangeError };
  }

  await clearSessionCookies();
  redirect("/login?passwordChanged=1");
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    redirect("/login?error=missing");
  }

  const user = await prisma.user.findUnique({
    where: {
      username,
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=invalid");
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
