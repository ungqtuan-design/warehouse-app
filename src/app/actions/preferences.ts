"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { uiCookieNames, type UiLanguage, type UiTheme } from "@/lib/ui";

function getReturnPath(value: string | null) {
  if (!value) {
    return "/";
  }

  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith("/") ? value : "/";
  }
}

export async function setThemeAction(formData: FormData) {
  const theme = formData.get("theme") === "dark" ? "dark" : "light";
  const cookieStore = await cookies();
  const headerStore = await headers();

  cookieStore.set(uiCookieNames.theme, theme satisfies UiTheme, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });

  redirect(getReturnPath(headerStore.get("referer")));
}

export async function setLanguageAction(formData: FormData) {
  const language = formData.get("language") === "vi" ? "vi" : "en";
  const cookieStore = await cookies();
  const headerStore = await headers();

  cookieStore.set(uiCookieNames.language, language satisfies UiLanguage, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });

  redirect(getReturnPath(headerStore.get("referer")));
}
