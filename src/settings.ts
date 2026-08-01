/**
 * User settings: model, persistence (localStorage) and live application to the
 * DOM. Works in both the Tauri WebView and a plain browser.
 */

import type { SoundLevel } from "./keysound";

export type ThemeChoice = "system" | "light" | "dark";
export type LineWidth = "narrow" | "medium" | "wide";

export interface Settings {
  theme: ThemeChoice;
  lineWidth: LineWidth;
  fontSize: number; // px, applied to the editor body text
  confirmOnClose: boolean; // warn before discarding unsaved changes
  restoreLast: boolean; // reopen the last file on startup (Tauri only)
  keySound: boolean; // mechanical typing sound
  keySoundLevel: SoundLevel; // volume of the typing sound
}

export const DEFAULTS: Settings = {
  theme: "system",
  lineWidth: "medium",
  fontSize: 17,
  confirmOnClose: true,
  restoreLast: true,
  keySound: true,
  keySoundLevel: "medium",
};

const STORAGE_KEY = "typemd.settings";

const LINE_WIDTHS: Record<LineWidth, string> = {
  narrow: "620px",
  medium: "720px",
  wide: "880px",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

const mql = window.matchMedia("(prefers-color-scheme: dark)");

function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice === "system") return mql.matches ? "dark" : "light";
  return choice;
}

/**
 * Apply settings to the document. Sets a resolved `data-theme` on <html> so the
 * CSS never has to branch on the system preference directly, plus CSS custom
 * properties for width and font size.
 */
export function applySettings(settings: Settings): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(settings.theme);
  root.style.setProperty("--tm-content-width", LINE_WIDTHS[settings.lineWidth]);
  root.style.setProperty("--tm-font-size", `${settings.fontSize}px`);
}

/**
 * Keep the resolved theme in sync with the OS when the user chose "system".
 * Returns an unsubscribe function.
 */
export function watchSystemTheme(getSettings: () => Settings): () => void {
  const handler = () => {
    if (getSettings().theme === "system") applySettings(getSettings());
  };
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}
