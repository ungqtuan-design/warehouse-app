import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "mims_session";
const LEGACY_SESSION_COOKIE_NAME = "wiings_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function deleteSessionCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  try {
    cookieStore.delete(SESSION_COOKIE_NAME);
    cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);
  } catch {
    // Cookies can only be mutated in a Server Action or Route Handler.
    // Reading a stale cookie during a plain render is fine; it will be
    // cleared the next time a Server Action or Route Handler runs.
  }
}

export const getCurrentSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.userSession.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          role: true,
        },
      },
    },
  });

  if (!session) {
    deleteSessionCookies(cookieStore);
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.userSession.delete({
      where: {
        id: session.id,
      },
    });

    deleteSessionCookies(cookieStore);
    return null;
  }

  return session;
});

export async function getCurrentUser() {
  return (await getCurrentSession())?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== UserRole.ADMIN) {
    redirect("/");
  }

  return user;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.userSession.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.userSession.deleteMany({
      where: {
        tokenHash: hashToken(token),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);
}

export function getRoleLabel(role: UserRole) {
  return role === UserRole.ADMIN ? "Admin" : "Operation";
}
