"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { uiCookieNames, type UiLanguage, type UiTheme } from "@/lib/ui-preferences";

type PreferenceTogglesProps = {
  theme: UiTheme;
  language: UiLanguage;
  text: {
    lightMode: string;
    darkMode: string;
    english: string;
    vietnamese: string;
  };
};

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; samesite=lax; max-age=31536000`;
}

function applyTheme(nextTheme: UiTheme) {
  document.body.classList.remove("theme-light", "theme-dark");
  document.body.classList.add(`theme-${nextTheme}`);
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-300 bg-white/80 p-1 shadow-sm backdrop-blur theme-toggle-shell">
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function PreferenceToggles({ theme, language, text }: PreferenceTogglesProps) {
  const router = useRouter();
  const [currentTheme, setCurrentTheme] = useState<UiTheme>(theme);
  const [currentLanguage, setCurrentLanguage] = useState<UiLanguage>(language);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup
        value={currentTheme}
        onChange={(value) => {
          const nextTheme = value as UiTheme;

          if (nextTheme === currentTheme) {
            return;
          }

          setCurrentTheme(nextTheme);
          setCookie(uiCookieNames.theme, nextTheme);
          applyTheme(nextTheme);
        }}
        options={[
          { label: text.lightMode, value: "light" },
          { label: text.darkMode, value: "dark" },
        ]}
      />
      <ToggleGroup
        value={currentLanguage}
        onChange={(value) => {
          const nextLanguage = value as UiLanguage;

          if (nextLanguage === currentLanguage) {
            return;
          }

          setCurrentLanguage(nextLanguage);
          setCookie(uiCookieNames.language, nextLanguage);
          startTransition(() => {
            router.refresh();
          });
        }}
        options={[
          { label: text.english, value: "en" },
          { label: text.vietnamese, value: "vi" },
        ]}
      />
    </div>
  );
}