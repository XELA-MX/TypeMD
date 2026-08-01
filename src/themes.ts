/**
 * Named color themes ("skins"). System / Light / Dark use the base stylesheet;
 * the named skins inject a palette for both the app chrome (--tm-*) and the
 * Milkdown editor (--crepe-color-*), scoped by a `data-skin` attribute on
 * <html>. The generated rule for `.milkdown` outranks Crepe's own frame theme.
 */

export type ThemeMode = "light" | "dark";

interface Skin {
  mode: ThemeMode; // base mode for scrollbars, etc.
  tm: Record<string, string>;
  crepe: Record<string, string>;
}

const skin = (
  mode: ThemeMode,
  tm: Record<string, string>,
  crepe: Record<string, string>,
): Skin => ({ mode, tm, crepe });

export const SKINS: Record<string, Skin> = {
  nord: skin(
    "dark",
    {
      bg: "#2e3440", fg: "#d8dee9", muted: "#7b88a1", border: "#3b4252",
      surface: "#3b4252", hover: "#434c5e", accent: "#88c0d0", "on-accent": "#2e3440",
    },
    {
      background: "#2e3440", "on-background": "#eceff4", surface: "#3b4252",
      "surface-low": "#434c5e", "on-surface": "#e5e9f0", "on-surface-variant": "#d8dee9",
      outline: "#4c566a", primary: "#88c0d0", secondary: "#434c5e", "on-secondary": "#eceff4",
      inverse: "#d8dee9", "on-inverse": "#2e3440", "inline-code": "#bf616a",
      error: "#bf616a", hover: "#3b4252", selected: "#434c5e", "inline-area": "#434c5e",
    },
  ),
  "solarized-light": skin(
    "light",
    {
      bg: "#fdf6e3", fg: "#073642", muted: "#93a1a1", border: "#eee8d5",
      surface: "#eee8d5", hover: "#e6dfc8", accent: "#268bd2", "on-accent": "#fdf6e3",
    },
    {
      background: "#fdf6e3", "on-background": "#073642", surface: "#eee8d5",
      "surface-low": "#e6dfc8", "on-surface": "#586e75", "on-surface-variant": "#657b83",
      outline: "#93a1a1", primary: "#268bd2", secondary: "#eee8d5", "on-secondary": "#073642",
      inverse: "#073642", "on-inverse": "#fdf6e3", "inline-code": "#dc322f",
      error: "#dc322f", hover: "#eee8d5", selected: "#e6dfc8", "inline-area": "#eee8d5",
    },
  ),
  "rose-pine": skin(
    "dark",
    {
      bg: "#191724", fg: "#e0def4", muted: "#6e6a86", border: "#26233a",
      surface: "#1f1d2e", hover: "#26233a", accent: "#ebbcba", "on-accent": "#191724",
    },
    {
      background: "#191724", "on-background": "#e0def4", surface: "#1f1d2e",
      "surface-low": "#26233a", "on-surface": "#e0def4", "on-surface-variant": "#908caa",
      outline: "#403d52", primary: "#c4a7e7", secondary: "#26233a", "on-secondary": "#e0def4",
      inverse: "#e0def4", "on-inverse": "#191724", "inline-code": "#eb6f92",
      error: "#eb6f92", hover: "#26233a", selected: "#403d52", "inline-area": "#26233a",
    },
  ),
};

/** Theme options for the settings dropdown. */
export const THEME_OPTIONS: { id: string; name: string }[] = [
  { id: "system", name: "System" },
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
  { id: "nord", name: "Nord" },
  { id: "solarized-light", name: "Solarized Light" },
  { id: "rose-pine", name: "Rosé Pine" },
];

export function skinMode(id: string): ThemeMode | null {
  return SKINS[id]?.mode ?? null;
}

/** Inject the skin palettes as a stylesheet (once). */
export function installThemes(): void {
  if (document.getElementById("tm-skins")) return;
  let css = "";
  for (const [id, s] of Object.entries(SKINS)) {
    const tmVars = Object.entries(s.tm)
      .map(([k, v]) => `--tm-${k}:${v};`)
      .join("");
    const crepeVars = Object.entries(s.crepe)
      .map(([k, v]) => `--crepe-color-${k}:${v};`)
      .join("");
    css += `:root[data-skin="${id}"]{${tmVars}}`;
    css += `:root[data-skin="${id}"] .milkdown{${crepeVars}}`;
  }
  const style = document.createElement("style");
  style.id = "tm-skins";
  style.textContent = css;
  document.head.append(style);
}
