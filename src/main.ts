import { Editor } from "./editor";
import {
  openFile,
  openFolder,
  openFileByPath,
  saveFile,
  isTauri,
  type OpenedFile,
} from "./files";
import {
  loadSettings,
  saveSettings,
  applySettings,
  watchSystemTheme,
  type Settings,
} from "./settings";
import { openSettingsPanel } from "./settingsPanel";
import { openExportDialog } from "./export";
import { Sidebar } from "./sidebar";
import { Outline } from "./outline";
import { FindReplace } from "./findReplace";
import { enableImages } from "./images";
import { setIcon } from "./icons";
import { KeySound } from "./keysound";
import "./styles.css";

const DEFAULT_DOC = `# Welcome to TypeMD

A minimalist, **WYSIWYG** markdown editor — your Typora alternative.

Start typing. Markdown transforms as you go:

- \`##\` becomes a heading
- \`**bold**\` becomes **bold**
- \`- [ ]\` becomes a task

> Open a file with **Ctrl+O**, a folder with **Ctrl+Shift+O**, save with **Ctrl+S**.

Happy writing.
`;

const LAST_FILE_KEY = "typemd.lastFile";

// --- App state -------------------------------------------------------------

interface DocState {
  path: string | null;
  name: string;
  dirty: boolean;
  content: string;
}

const state: DocState = {
  path: null,
  name: "Untitled",
  dirty: false,
  content: DEFAULT_DOC,
};

let settings: Settings = loadSettings();

const keySound = new KeySound();

// --- DOM references --------------------------------------------------------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const editorRoot = $("editor");
const titleEl = $("doc-title");
const dirtyDot = $("dirty-dot");
const wordCountEl = $("word-count");
const saveHintEl = $("save-hint");
const sidebarEl = $("sidebar");
const outlineEl = $("outline");
const btnTheme = $("btn-theme");

// --- Editor ----------------------------------------------------------------

let outlineTimer: number | undefined;

const editor = new Editor(editorRoot, {
  onChange: (markdown) => {
    state.content = markdown;
    if (!state.dirty) {
      state.dirty = true;
      renderChrome();
    }
    updateWordCount(markdown);
    // Rebuild the outline shortly after typing settles.
    window.clearTimeout(outlineTimer);
    outlineTimer = window.setTimeout(() => outline.rebuild(), 300);
  },
});

// --- Sidebar & outline -----------------------------------------------------

const sidebar = new Sidebar($("file-tree"), $("folder-name"), (path) => {
  void openFromTree(path);
});

const outline = new Outline($("outline-list"), editorRoot);

const findReplace = new FindReplace(editor, {
  bar: $("find-bar"),
  findInput: $<HTMLInputElement>("find-input"),
  replaceInput: $<HTMLInputElement>("replace-input"),
  count: $("find-count"),
  prev: $("find-prev"),
  next: $("find-next"),
  close: $("find-close"),
  replaceOne: $("replace-one"),
  replaceAll: $("replace-all"),
});

/** Load content into the editor and refresh derived views. */
async function reloadEditor(content: string): Promise<void> {
  await editor.load(content);
  outline.rebuild();
}

// --- UI updates ------------------------------------------------------------

function renderChrome(): void {
  titleEl.textContent = state.name;
  dirtyDot.style.opacity = state.dirty ? "1" : "0";
  document.title = `${state.dirty ? "• " : ""}${state.name} — TypeMD`;
}

function updateWordCount(markdown: string): void {
  const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  wordCountEl.textContent = `${words} word${words === 1 ? "" : "s"}`;
}

function updateThemeIcon(): void {
  const isDark = document.documentElement.dataset.theme === "dark";
  setIcon(btnTheme, isDark ? "sun" : "moon");
}

let hintTimer: number | undefined;
function flashHint(text: string): void {
  saveHintEl.textContent = text;
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => (saveHintEl.textContent = ""), 2000);
}

// --- Settings --------------------------------------------------------------

function applyAndSave(next: Settings): void {
  settings = next;
  applySettings(settings);
  saveSettings(settings);
  updateThemeIcon();
  keySound.setConfig(settings.keySound, settings.keySoundLevel);
}

// --- Document actions ------------------------------------------------------

function rememberLast(path: string | null): void {
  if (path) localStorage.setItem(LAST_FILE_KEY, path);
}

function adopt(file: OpenedFile): void {
  state.path = file.path;
  state.name = file.name;
  state.content = file.content;
  state.dirty = false;
  rememberLast(file.path);
  renderChrome();
  updateWordCount(file.content);
  sidebar.setActive(file.path);
}

async function guardUnsaved(): Promise<boolean> {
  if (!state.dirty || !settings.confirmOnClose) return true;
  return confirm("Discard unsaved changes?");
}

async function doOpen(): Promise<void> {
  if (!(await guardUnsaved())) return;
  const file = await openFile();
  if (!file) return;
  adopt(file);
  await reloadEditor(file.content);
  editor.focus();
}

async function doOpenFolder(): Promise<void> {
  const folder = await openFolder();
  if (!folder) return;
  sidebar.setFolder(folder.name, folder.tree);
  setSidebarVisible(true);
}

async function openFromTree(path: string): Promise<void> {
  if (path === state.path) return;
  if (!(await guardUnsaved())) return;
  const file = await openFileByPath(path);
  if (!file) return;
  adopt(file);
  await reloadEditor(file.content);
  editor.focus();
}

async function doSave(): Promise<void> {
  const content = editor.getMarkdown();
  const saved = await saveFile(content, state.path);
  if (!saved) return;
  adopt(saved);
  flashHint("Saved");
}

async function doNew(): Promise<void> {
  if (!(await guardUnsaved())) return;
  adopt({ path: null, name: "Untitled", content: "" });
  await reloadEditor("");
  editor.focus();
}

function doExport(): void {
  openExportDialog(editor.getMarkdown(), state.name);
}

// --- Sidebar visibility ----------------------------------------------------

function setSidebarVisible(visible: boolean): void {
  sidebarEl.hidden = !visible;
}

function toggleSidebar(): void {
  setSidebarVisible(sidebarEl.hidden);
}

function toggleOutline(): void {
  outlineEl.hidden = !outlineEl.hidden;
  if (!outlineEl.hidden) outline.rebuild();
}

// --- Theme toggle ----------------------------------------------------------

function toggleTheme(): void {
  const isDark = document.documentElement.dataset.theme === "dark";
  applyAndSave({ ...settings, theme: isDark ? "light" : "dark" });
}

// --- Wiring ----------------------------------------------------------------

function wireToolbar(): void {
  setIcon($("btn-sidebar"), "menu");
  setIcon($("btn-open"), "file");
  setIcon($("btn-open-folder"), "folder");
  setIcon($("btn-new"), "filePlus");
  setIcon($("btn-find"), "search");
  setIcon($("btn-export"), "download");
  setIcon($("btn-outline"), "list");
  setIcon($("btn-settings"), "settings");
  updateThemeIcon();

  $("btn-sidebar").addEventListener("click", toggleSidebar);
  $("btn-open").addEventListener("click", () => void doOpen());
  $("btn-open-folder").addEventListener("click", () => void doOpenFolder());
  $("btn-new").addEventListener("click", () => void doNew());
  $("btn-find").addEventListener("click", () => findReplace.toggle());
  $("btn-export").addEventListener("click", () => void doExport());
  $("btn-outline").addEventListener("click", toggleOutline);
  $("btn-theme").addEventListener("click", toggleTheme);
  $("btn-settings").addEventListener("click", () =>
    openSettingsPanel(settings, applyAndSave),
  );
}

// Typing sound — capture phase so it fires for every key regardless of where
// focus sits (editor, sidebar, etc.).
window.addEventListener("keydown", (e) => keySound.play(e), { capture: true });

window.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;

  const key = e.key.toLowerCase();
  if (key === "o" && e.shiftKey) {
    e.preventDefault();
    void doOpenFolder();
  } else if (key === "o") {
    e.preventDefault();
    void doOpen();
  } else if (key === "s") {
    e.preventDefault();
    void doSave();
  } else if (key === "n") {
    e.preventDefault();
    void doNew();
  } else if (key === "b") {
    e.preventDefault();
    toggleSidebar();
  } else if (key === "k" && e.shiftKey) {
    e.preventDefault();
    toggleOutline();
  } else if (key === "f") {
    e.preventDefault();
    findReplace.open();
  } else if (key === "e") {
    e.preventDefault();
    void doExport();
  } else if (key === ",") {
    e.preventDefault();
    openSettingsPanel(settings, applyAndSave);
  }
});

// --- Native window close guard (Tauri) -------------------------------------

async function wireCloseGuard(): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const { ask } = await import("@tauri-apps/plugin-dialog");
  const win = getCurrentWindow();
  await win.onCloseRequested(async (event) => {
    if (!state.dirty || !settings.confirmOnClose) return;
    const proceed = await ask("You have unsaved changes. Close anyway?", {
      title: "TypeMD",
      kind: "warning",
    });
    if (!proceed) event.preventDefault();
  });
}

// --- Boot ------------------------------------------------------------------

async function restoreLastFile(): Promise<boolean> {
  if (!isTauri() || !settings.restoreLast) return false;
  const last = localStorage.getItem(LAST_FILE_KEY);
  if (!last) return false;
  const file = await openFileByPath(last);
  if (!file) return false;
  adopt(file);
  await reloadEditor(file.content);
  return true;
}

async function boot(): Promise<void> {
  applySettings(settings);
  keySound.setConfig(settings.keySound, settings.keySoundLevel);
  watchSystemTheme(() => settings);
  wireToolbar();
  enableImages(editor, editorRoot);

  const restored = await restoreLastFile();
  if (!restored) {
    await reloadEditor(state.content);
    renderChrome();
    updateWordCount(state.content);
  }
  editor.focus();

  if (isTauri()) {
    document.body.classList.add("is-tauri");
    void wireCloseGuard();
  }
}

void boot();
