/**
 * User settings: model, persistence (localStorage) and live application to the
 * DOM. Works in both the Tauri WebView and a plain browser.
 */

import type { SoundLevel } from "./keysound";
import { SKINS, skinMode } from "./themes";

// "system" | "light" | "dark" | a skin id from themes.ts
export type ThemeChoice = string;
export type LineWidth = "narrow" | "medium" | "wide";

export interface Settings {
  theme: ThemeChoice;
  lineWidth: LineWidth;
  fontSize: number; // px, applied to the editor body text
  confirmOnClose: boolean; // warn before discarding unsaved changes
  restoreLast: boolean; // reopen the last file on startup (Tauri only)
  keySound: boolean; // mechanical typing sound
  keySoundLevel: SoundLevel; // volume of the typing sound
  focusMode: boolean; // dim everything but the active block
  typewriterMode: boolean; // keep the caret vertically centered
  autosave: boolean; // silently save the current file after edits settle
}

export const DEFAULTS: Settings = {
  theme: "system",
  lineWidth: "medium",
  fontSize: 17,
  confirmOnClose: true,
  restoreLast: true,
  keySound: true,
  keySoundLevel: "medium",
  focusMode: false,
  typewriterMode: false,
  autosave: false,
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

function resolveMode(choice: ThemeChoice): "light" | "dark" {
  if (choice === "system") return mql.matches ? "dark" : "light";
  if (choice === "light" || choice === "dark") return choice;
  return skinMode(choice) ?? "light";
}

/**
 * Apply settings to the document. Sets a resolved `data-theme` (light/dark base)
 * and an optional `data-skin` (named palette) on <html>, plus CSS custom
 * properties for width and font size.
 */
export function applySettings(settings: Settings): void {
  const root = document.documentElement;
  root.dataset.theme = resolveMode(settings.theme);
  if (SKINS[settings.theme]) root.dataset.skin = settings.theme;
  else delete root.dataset.skin;
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
