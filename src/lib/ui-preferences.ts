export type UiTheme = "light" | "dark";
export type UiLanguage = "en" | "vi";

export const uiCookieNames = {
  theme: "mims_theme",
  language: "mims_lang",
} as const;

export const legacyUiCookieNames = {
  theme: "wiings_theme",
  language: "wiings_lang",
} as const;