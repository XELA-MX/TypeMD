import nspell from "nspell";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node as PMNode } from "@milkdown/kit/prose/model";

/**
 * Bilingual (English + Spanish) spell checking.
 *
 * Words are checked against both Hunspell dictionaries (correct if valid in
 * either language). Misspellings get a red wavy underline via ProseMirror
 * decorations; hovering shows the top suggestion, and clicking it applies the
 * fix. Dictionaries load lazily from /dict on first enable.
 */

type Speller = ReturnType<typeof nspell>;

const spellKey = new PluginKey<DecorationSet>("typemd-spell");
const WORD_RE = /\p{L}[\p{L}\p{M}'’]*/gu;

let spellers: Speller[] = [];
let loading: Promise<void> | null = null;
let enabled = false;
let pluginView: EditorView | null = null;
let menu: HTMLElement | null = null;

const CUSTOM_KEY = "typemd.dictionary";
const ignored = new Set<string>();

function loadCustomWords(): void {
  try {
    (JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]") as string[]).forEach(
      (w) => ignored.add(w.toLowerCase()),
    );
  } catch {
    /* ignore */
  }
}

function addToDictionary(word: string): void {
  ignored.add(word.toLowerCase());
  try {
    const arr = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]") as string[];
    if (!arr.includes(word)) {
      arr.push(word);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr));
    }
  } catch {
    /* ignore */
  }
}

async function loadDictionaries(): Promise<void> {
  if (spellers.length) return;
  if (!loading) {
    loading = (async () => {
      const load = async (lang: string): Promise<Speller> => {
        const [aff, dic] = await Promise.all([
          fetch(`/dict/${lang}.aff`).then((r) => r.text()),
          fetch(`/dict/${lang}.dic`).then((r) => r.text()),
        ]);
        return nspell(aff, dic);
      };
      spellers = await Promise.all([load("en"), load("es")]);
    })();
  }
  await loading;
}

function isMisspelled(word: string): boolean {
  if (word.length < 2) return false;
  // Skip camelCase / PascalCase / ALLCAPS tokens (usually code or names).
  if (/[A-Z]/.test(word.slice(1))) return false;
  if (ignored.has(word.toLowerCase())) return false;
  return !spellers.some((s) => s.correct(word));
}

function suggestions(word: string): string[] {
  const out: string[] = [];
  for (const s of spellers) out.push(...s.suggest(word).slice(0, 3));
  return [...new Set(out)];
}

function buildDecos(doc: PMNode): DecorationSet {
  if (!enabled || !spellers.length) return DecorationSet.empty;
  const decos: Decoration[] = [];
  doc.descendants((node, pos, parent) => {
    if (parent?.type.name === "code_block") return false;
    if (!node.isText || !node.text) return true;
    if (node.marks.some((m) => m.type.name === "inlineCode")) return true;
    for (const m of node.text.matchAll(WORD_RE)) {
      const word = m[0];
      if (isMisspelled(word)) {
        const from = pos + (m.index ?? 0);
        decos.push(
          Decoration.inline(from, from + word.length, {
            class: "spell-error",
          }),
        );
      }
    }
    return true;
  });
  return DecorationSet.create(doc, decos);
}

let rebuildTimer: number | undefined;
function scheduleRebuild(): void {
  window.clearTimeout(rebuildTimer);
  rebuildTimer = window.setTimeout(() => {
    if (pluginView)
      pluginView.dispatch(pluginView.state.tr.setMeta(spellKey, true));
  }, 400);
}

function spellPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: spellKey,
    state: {
      init: (_c, state) => buildDecos(state.doc),
      apply(tr, old) {
        if (tr.getMeta(spellKey)) return buildDecos(tr.doc);
        if (tr.docChanged) {
          scheduleRebuild();
          return old.map(tr.mapping, tr.doc);
        }
        return old;
      },
    },
    props: {
      decorations: (state) => spellKey.getState(state),
    },
    view: (view) => {
      pluginView = view;
      return {
        destroy: () => {
          if (pluginView === view) pluginView = null;
        },
      };
    },
  });
}

// --- Right-click suggestions menu -----------------------------------------

function closeMenu(): void {
  menu?.remove();
  menu = null;
}

function replaceWord(
  view: EditorView,
  span: HTMLElement,
  word: string,
  replacement: string,
): void {
  const pos = view.posAtDOM(span, 0);
  view.dispatch(view.state.tr.insertText(replacement, pos, pos + word.length));
  scheduleRebuild();
}

function showMenu(
  span: HTMLElement,
  view: EditorView,
  x: number,
  y: number,
): void {
  const word = span.textContent || "";
  closeMenu();

  const el = document.createElement("div");
  el.className = "ctx-menu spell-menu";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const picks = suggestions(word).slice(0, 6);
  if (picks.length === 0) {
    const none = document.createElement("div");
    none.className = "ctx-item disabled";
    none.textContent = "No suggestions";
    el.append(none);
  } else {
    for (const s of picks) {
      const item = document.createElement("div");
      item.className = "ctx-item";
      item.textContent = s;
      item.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        closeMenu();
        replaceWord(view, span, word, s);
      });
      el.append(item);
    }
  }

  const sep = document.createElement("div");
  sep.className = "ctx-sep";
  el.append(sep);

  const add = document.createElement("div");
  add.className = "ctx-item";
  add.textContent = "Add to dictionary";
  add.addEventListener("mousedown", (ev) => {
    ev.preventDefault();
    closeMenu();
    addToDictionary(word);
    scheduleRebuild();
  });
  el.append(add);

  document.body.append(el);
  menu = el;

  // Keep the menu on-screen.
  const r = el.getBoundingClientRect();
  if (r.right > window.innerWidth)
    el.style.left = `${window.innerWidth - r.width - 8}px`;
  if (r.bottom > window.innerHeight) el.style.top = `${y - r.height}px`;
}

function wireContextMenu(): void {
  // Document-level delegation; `pluginView` always points at the current view.
  document.addEventListener("contextmenu", (e) => {
    const t = e.target as HTMLElement;
    if (t.classList?.contains("spell-error") && pluginView) {
      e.preventDefault();
      showMenu(t, pluginView, e.clientX, e.clientY);
    }
  });
  document.addEventListener("mousedown", (e) => {
    if (menu && !(e.target as HTMLElement).closest?.(".spell-menu")) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}

// --- Public API ------------------------------------------------------------

let menuWired = false;

/** Enable/disable and attach the checker to the current view. */
export async function setupSpellcheck(
  view: EditorView | null,
  on: boolean,
): Promise<void> {
  enabled = on;
  if (!view) return;

  if (on) {
    loadCustomWords();
    await loadDictionaries();
  }

  if (spellKey.getState(view.state) === undefined) {
    view.updateState(
      view.state.reconfigure({
        plugins: view.state.plugins.concat(spellPlugin()),
      }),
    );
  }
  if (!menuWired) {
    wireContextMenu();
    menuWired = true;
  }
  // Recompute now that enabled/loaded state may have changed.
  const v = pluginView ?? view;
  v.dispatch(v.state.tr.setMeta(spellKey, true));
  if (!on) closeMenu();
}
