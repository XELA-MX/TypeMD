import { Editor } from "./editor";
import {
  openFile,
  openFolder,
  openFileByPath,
  saveFile,
  isTauri,
  refreshTree,
  joinPath,
  createFile,
  createDir,
  renamePath,
  removePath,
  getInitialFile,
  onOpenFileRequested,
  watchFile,
  type OpenedFile,
  type FileNode,
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
import { openCommandPalette, type Command } from "./commandPalette";
import { Sidebar, type SidebarAction } from "./sidebar";
import { Outline } from "./outline";
import { promptModal, confirmUnsaved } from "./prompt";
import { FindReplace } from "./findReplace";
import { enableImages } from "./images";
import { SourceMode } from "./sourceMode";
import { WritingModes } from "./writingModes";
import { attachMermaid, setMermaidDark } from "./mermaidView";
import { setupSpellcheck } from "./spellcheck";
import { installThemes } from "./themes";
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
const RECENTS_KEY = "typemd.recents";
const MAX_RECENTS = 12;

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

let folderPath: string | null = null;
let folderTree: FileNode[] = [];

// External-change watch state.
let unwatch: (() => void) | null = null;
let ignoreWatchUntil = 0;

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

// Serialized markdown of the freshly loaded document, used as the baseline so
// Crepe's initial render doesn't count as an unsaved edit.
let loadedContent = "";
let isLoading = false;

const editor = new Editor(editorRoot, {
  onChange: (markdown) => {
    state.content = markdown;
    // The change Crepe emits while a document is loading is the baseline, not
    // a user edit.
    if (isLoading) {
      loadedContent = markdown;
      return;
    }
    if (markdown === loadedContent) return;
    if (!state.dirty) {
      state.dirty = true;
      renderChrome();
    }
    updateWordCount(markdown);
    // Rebuild the outline shortly after typing settles.
    window.clearTimeout(outlineTimer);
    outlineTimer = window.setTimeout(() => outline.rebuild(), 300);
    scheduleAutosave();
  },
});

// --- Sidebar & outline -----------------------------------------------------

const sidebar = new Sidebar(
  $("file-tree"),
  $("folder-name"),
  (path) => void openFromTree(path),
  (action, node) => void handleSidebarAction(action, node),
);

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

const writingModes = new WritingModes(editor, editorRoot);

const sourceMode = new SourceMode(
  editor,
  editorRoot,
  $<HTMLTextAreaElement>("source-view"),
  (md) => reloadEditor(md),
  () => {
    if (!state.dirty) {
      state.dirty = true;
      renderChrome();
    }
    updateWordCount(sourceMode.currentMarkdown());
    scheduleAutosave();
  },
);

const isDark = (): boolean => document.documentElement.dataset.theme === "dark";

/** The authoritative markdown, accounting for source-view edits. */
function currentMarkdown(): string {
  return sourceMode.currentMarkdown();
}

/** Load content into the editor and refresh derived views. */
async function reloadEditor(content: string): Promise<void> {
  // Baseline against Crepe's own serialization so the initial render isn't seen
  // as a user edit. Note: this does NOT reset `state.dirty` — the caller owns
  // that (adopt() clears it on open; source-view exit keeps it).
  isLoading = true;
  await editor.load(content);
  loadedContent = editor.getMarkdown();
  isLoading = false;
  editor.setSpellcheck(false); // suppress native underlines; we use our own
  outline.rebuild();
  attachMermaid(editor.getView(), isDark());
  writingModes.refresh();
  void setupSpellcheck(editor.getView(), settings.spellcheck);
  renderChrome();
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
  writingModes.setModes(settings.focusMode, settings.typewriterMode);
  setMermaidDark(isDark());
  void setupSpellcheck(editor.getView(), settings.spellcheck);
}

// --- Document actions ------------------------------------------------------

function rememberLast(path: string | null): void {
  if (path) localStorage.setItem(LAST_FILE_KEY, path);
}

interface Recent {
  path: string;
  name: string;
}

function loadRecents(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]") as Recent[];
  } catch {
    return [];
  }
}

function addRecent(file: OpenedFile): void {
  if (!file.path) return;
  const path = file.path;
  const recents = loadRecents().filter((r) => r.path !== path);
  recents.unshift({ path, name: file.name });
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
}

async function restartWatch(): Promise<void> {
  unwatch?.();
  unwatch = null;
  if (isTauri() && state.path) {
    unwatch = await watchFile(state.path, () => void onFileChangedExternally());
  }
}

async function onFileChangedExternally(): Promise<void> {
  if (Date.now() < ignoreWatchUntil || !state.path) return;
  const fresh = await openFileByPath(state.path);
  if (!fresh || fresh.content === currentMarkdown()) return;
  if (state.dirty) {
    flashHint("File changed on disk");
    return;
  }
  adopt(fresh);
  await reloadEditor(fresh.content);
}

function adopt(file: OpenedFile): void {
  state.path = file.path;
  state.name = file.name;
  state.content = file.content;
  state.dirty = false;
  rememberLast(file.path);
  addRecent(file);
  renderChrome();
  updateWordCount(file.content);
  sidebar.setActive(file.path);
  void restartWatch();
}

async function guardUnsaved(): Promise<boolean> {
  if (!state.dirty || !settings.confirmOnClose) return true;
  const choice = await confirmUnsaved(state.name);
  if (choice === "save") {
    await doSave();
    return !state.dirty; // proceed only if the save actually went through
  }
  return choice === "discard";
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
  folderPath = folder.path;
  folderTree = folder.tree;
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

/** Open a file handed to us by the OS (CLI arg or a second instance). */
async function openIncoming(file: OpenedFile): Promise<void> {
  if (!(await guardUnsaved())) return;
  adopt(file);
  await reloadEditor(file.content);
  editor.focus();
}

async function doSave(): Promise<void> {
  const content = currentMarkdown();
  ignoreWatchUntil = Date.now() + 1200;
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
  openExportDialog(currentMarkdown(), state.name);
}

// --- Autosave --------------------------------------------------------------

let autosaveTimer: number | undefined;

function scheduleAutosave(): void {
  if (!settings.autosave || !state.path) return;
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => void autosaveNow(), 1200);
}

async function autosaveNow(): Promise<void> {
  if (!state.dirty || !state.path) return;
  ignoreWatchUntil = Date.now() + 1200;
  const saved = await saveFile(currentMarkdown(), state.path);
  if (!saved) return;
  state.dirty = false;
  renderChrome();
  flashHint("Autosaved");
}

// --- Command palette -------------------------------------------------------

function flattenFiles(nodes: FileNode[], out: FileNode[] = []): FileNode[] {
  for (const n of nodes) {
    if (n.isDir) flattenFiles(n.children ?? [], out);
    else out.push(n);
  }
  return out;
}

function buildCommands(): Command[] {
  const cmds: Command[] = [
    { id: "new", title: "New file", hint: "Ctrl+N", run: () => void doNew() },
    { id: "open", title: "Open file…", hint: "Ctrl+O", run: () => void doOpen() },
    { id: "openFolder", title: "Open folder…", hint: "Ctrl+Shift+O", run: () => void doOpenFolder() },
    { id: "save", title: "Save", hint: "Ctrl+S", run: () => void doSave() },
    { id: "export", title: "Export…", hint: "Ctrl+E", run: () => doExport() },
    { id: "find", title: "Find & replace", hint: "Ctrl+F", run: () => findReplace.open() },
    { id: "source", title: "Toggle source view", hint: "Ctrl+/", run: () => void sourceMode.toggle() },
    { id: "sidebar", title: "Toggle sidebar", hint: "Ctrl+B", run: toggleSidebar },
    { id: "outline", title: "Toggle outline", hint: "Ctrl+Shift+K", run: toggleOutline },
    { id: "theme", title: "Toggle theme", run: toggleTheme },
    { id: "focus", title: "Toggle focus mode", run: () => applyAndSave({ ...settings, focusMode: !settings.focusMode }) },
    { id: "typewriter", title: "Toggle typewriter mode", run: () => applyAndSave({ ...settings, typewriterMode: !settings.typewriterMode }) },
    { id: "settings", title: "Settings", hint: "Ctrl+,", run: () => openSettingsPanel(settings, applyAndSave) },
  ];

  // Recently opened files.
  for (const r of loadRecents()) {
    cmds.push({
      id: `recent:${r.path}`,
      title: r.name,
      hint: "recent",
      run: () => void openFromTree(r.path),
    });
  }

  // Quick-open files from the current folder.
  const seen = new Set(loadRecents().map((r) => r.path));
  for (const f of flattenFiles(folderTree)) {
    if (seen.has(f.path)) continue;
    cmds.push({
      id: `file:${f.path}`,
      title: f.name,
      hint: "file",
      run: () => void openFromTree(f.path),
    });
  }
  return cmds;
}

// --- Sidebar file operations -----------------------------------------------

const parentDir = (path: string): string =>
  path.slice(0, path.lastIndexOf("/")) || "/";

async function refreshFolder(): Promise<void> {
  if (!folderPath) return;
  folderTree = await refreshTree(folderPath);
  sidebar.updateTree(folderTree);
  sidebar.setActive(state.path);
}

async function handleSidebarAction(
  action: SidebarAction,
  node: FileNode | null,
): Promise<void> {
  try {
    if (action === "newFile") {
      const dir = node?.isDir ? node.path : folderPath;
      if (!dir) return;
      let name = await promptModal("New file name", "untitled.md", "Create");
      if (!name) return;
      if (!/\.[^.]+$/.test(name)) name += ".md";
      const path = joinPath(dir, name);
      await createFile(path);
      await refreshFolder();
      await openFromTree(path);
    } else if (action === "newFolder") {
      const dir = node?.isDir ? node.path : folderPath;
      if (!dir) return;
      const name = await promptModal("New folder name", "", "Create");
      if (!name) return;
      await createDir(joinPath(dir, name));
      await refreshFolder();
    } else if (action === "rename" && node) {
      const name = await promptModal("Rename", node.name, "Rename");
      if (!name || name === node.name) return;
      const to = joinPath(parentDir(node.path), name);
      await renamePath(node.path, to);
      if (node.path === state.path) {
        state.path = to;
        state.name = name;
        rememberLast(to);
        renderChrome();
      }
      await refreshFolder();
    } else if (action === "delete" && node) {
      const what = node.isDir ? "folder and its contents" : "file";
      if (!confirm(`Delete ${node.name}? This deletes the ${what}.`)) return;
      await removePath(node.path, node.isDir);
      if (node.path === state.path) {
        state.path = null;
        renderChrome();
      }
      await refreshFolder();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    flashHint(`Error: ${msg}`);
  }
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
  setIcon($("btn-source"), "code");
  setIcon($("btn-export"), "download");
  setIcon($("btn-outline"), "list");
  setIcon($("btn-settings"), "settings");
  updateThemeIcon();

  $("btn-sidebar").addEventListener("click", toggleSidebar);
  $("btn-open").addEventListener("click", () => void doOpen());
  $("btn-open-folder").addEventListener("click", () => void doOpenFolder());
  $("btn-new").addEventListener("click", () => void doNew());
  $("btn-find").addEventListener("click", () => findReplace.toggle());
  $("btn-source").addEventListener("click", () => void sourceMode.toggle());
  $("btn-export").addEventListener("click", () => void doExport());
  $("btn-outline").addEventListener("click", toggleOutline);
  $("btn-theme").addEventListener("click", toggleTheme);
  $("btn-settings").addEventListener("click", () =>
    openSettingsPanel(settings, applyAndSave),
  );

  setIcon($("btn-new-file"), "filePlus");
  setIcon($("btn-new-folder"), "folder");
  $("btn-new-file").addEventListener("click", () =>
    void handleSidebarAction("newFile", null),
  );
  $("btn-new-folder").addEventListener("click", () =>
    void handleSidebarAction("newFolder", null),
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
  } else if (key === "/") {
    e.preventDefault();
    void sourceMode.toggle();
  } else if (key === "p") {
    e.preventDefault();
    openCommandPalette(buildCommands());
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
  const win = getCurrentWindow();
  await win.onCloseRequested(async (event) => {
    // No unsaved work → let it close immediately.
    if (!state.dirty || !settings.confirmOnClose) return;
    // Block the close and ask with our own, clearly visible modal.
    event.preventDefault();
    const choice = await confirmUnsaved(state.name);
    if (choice === "save") {
      await doSave();
      if (!state.dirty) await win.destroy();
    } else if (choice === "discard") {
      await win.destroy();
    }
    // cancel → stay open
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

async function wireWindowControls(): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  setIcon($("win-min"), "winMin");
  setIcon($("win-close"), "close");

  const paintMax = async () => {
    setIcon($("win-max"), (await win.isMaximized()) ? "winRestore" : "winMax");
  };
  void paintMax();

  $("win-min").addEventListener("click", () => void win.minimize());
  $("win-max").addEventListener("click", async () => {
    await win.toggleMaximize();
    void paintMax();
  });
  $("win-close").addEventListener("click", () => void win.close());
}

async function boot(): Promise<void> {
  installThemes();
  applySettings(settings);
  keySound.setConfig(settings.keySound, settings.keySoundLevel);
  writingModes.setModes(settings.focusMode, settings.typewriterMode);
  setMermaidDark(isDark());
  watchSystemTheme(() => settings);
  wireToolbar();
  enableImages(editor, editorRoot);

  // A file passed on the command line wins over the restored last file.
  const initial = await getInitialFile();
  let opened = false;
  if (initial) {
    adopt(initial);
    await reloadEditor(initial.content);
    opened = true;
  } else {
    opened = await restoreLastFile();
  }
  if (!opened) {
    await reloadEditor(state.content);
    renderChrome();
    updateWordCount(state.content);
  }
  editor.focus();

  if (isTauri()) {
    document.body.classList.add("is-tauri");
    void wireCloseGuard();
    void wireWindowControls();
    void onOpenFileRequested((file) => void openIncoming(file));
  }
}

void boot();
