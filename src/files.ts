/**
 * File I/O abstraction.
 *
 * Runs in two environments:
 *  - Inside Tauri: uses the native dialog + fs plugins for real file access.
 *  - In a plain browser (`npm run dev` without Tauri): degrades to the File
 *    System Access API when available, otherwise a download/upload fallback,
 *    so the editor is still usable for quick UI iteration.
 */

export interface OpenedFile {
  path: string | null; // native path when known (Tauri), else null
  name: string;
  content: string;
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

export interface OpenedFolder {
  path: string;
  name: string;
  tree: FileNode[];
}

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MD_FILTERS = [
  { name: "Markdown", extensions: ["md", "markdown", "mdx", "txt"] },
];

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

// ---------------------------------------------------------------------------
// Tauri implementation
// ---------------------------------------------------------------------------

async function tauriOpen(): Promise<OpenedFile | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");

  const selected = await open({ multiple: false, filters: MD_FILTERS });
  if (typeof selected !== "string") return null;

  const content = await readTextFile(selected);
  return { path: selected, name: baseName(selected), content };
}

async function tauriSave(
  content: string,
  currentPath: string | null,
): Promise<OpenedFile | null> {
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");

  let path = currentPath;
  if (!path) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const chosen = await save({
      filters: MD_FILTERS,
      defaultPath: "Untitled.md",
    });
    if (!chosen) return null;
    path = chosen;
  }

  await writeTextFile(path, content);
  return { path, name: baseName(path), content };
}

async function tauriOpenPath(path: string): Promise<OpenedFile> {
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const content = await readTextFile(path);
  return { path, name: baseName(path), content };
}

const MD_EXT = /\.(md|markdown|mdx)$/i;
const MAX_TREE_DEPTH = 6;

async function readTree(dir: string, depth: number): Promise<FileNode[]> {
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const entries = await readDir(dir);
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // skip dotfiles/dirs
    const childPath = `${dir.replace(/\/$/, "")}/${entry.name}`;

    if (entry.isDirectory) {
      if (depth >= MAX_TREE_DEPTH) continue;
      const children = await readTree(childPath, depth + 1);
      if (children.length > 0) {
        nodes.push({ name: entry.name, path: childPath, isDir: true, children });
      }
    } else if (MD_EXT.test(entry.name)) {
      nodes.push({ name: entry.name, path: childPath, isDir: false });
    }
  }

  // Directories first, then files, each alphabetical (case-insensitive).
  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return nodes;
}

async function tauriOpenFolder(): Promise<OpenedFolder | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected !== "string") return null;

  const tree = await readTree(selected, 0);
  return { path: selected, name: baseName(selected), tree };
}

// ---------------------------------------------------------------------------
// Browser fallback (dev only)
// ---------------------------------------------------------------------------

async function browserOpen(): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.mdx,.txt,text/markdown";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const content = await file.text();
      resolve({ path: null, name: file.name, content });
    };
    input.click();
  });
}

function browserSave(
  content: string,
  currentPath: string | null,
): OpenedFile | null {
  const name = currentPath ? baseName(currentPath) : "Untitled.md";
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return { path: currentPath, name, content };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function openFile(): Promise<OpenedFile | null> {
  return isTauri() ? tauriOpen() : browserOpen();
}

export async function saveFile(
  content: string,
  currentPath: string | null,
): Promise<OpenedFile | null> {
  return isTauri()
    ? tauriSave(content, currentPath)
    : browserSave(content, currentPath);
}

export async function openFileByPath(path: string): Promise<OpenedFile | null> {
  return isTauri() ? tauriOpenPath(path) : null;
}

export async function openFolder(): Promise<OpenedFolder | null> {
  // Folder browsing is a native-only feature; no-op in the dev browser.
  return isTauri() ? tauriOpenFolder() : null;
}

export { isTauri };
