import mermaid from "mermaid";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node as PMNode } from "@milkdown/kit/prose/model";

/**
 * Live Mermaid rendering. A ProseMirror plugin adds a widget after every
 * ```mermaid code block. Each widget's DOM is filled in place once Mermaid
 * resolves (rather than swapping decorations), and results are cached by source
 * so unrelated edits stay cheap.
 */

const mermaidKey = new PluginKey<DecorationSet>("typemd-mermaid");
const cache = new Map<string, string>(); // source -> svg
let idSeq = 0;
let initialized = false;
let currentDark = false;

function ensureInit(dark: boolean): void {
  if (initialized && dark === currentDark) return;
  currentDark = dark;
  initialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? "dark" : "default",
    securityLevel: "strict",
    fontFamily: "inherit",
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
  );
}

function paint(div: HTMLElement, code: string): void {
  div.dataset.mmd = code;
  if (!code) {
    div.className = "mermaid-render mermaid-empty";
    div.textContent = "Empty diagram";
    return;
  }
  const cached = cache.get(code);
  if (cached !== undefined) {
    div.className = "mermaid-render";
    div.innerHTML = cached;
    return;
  }
  div.className = "mermaid-render mermaid-loading";
  div.textContent = "Rendering diagram…";
  mermaid
    .render(`tm-mermaid-${idSeq++}`, code)
    .then(({ svg }) => {
      cache.set(code, svg);
      if (div.dataset.mmd === code) {
        div.className = "mermaid-render";
        div.innerHTML = svg;
      }
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (div.dataset.mmd === code) {
        div.className = "mermaid-render";
        div.innerHTML = `<div class="mermaid-error">${escapeHtml(msg)}</div>`;
      }
    });
}

function makeWidget(code: string): HTMLElement {
  const div = document.createElement("div");
  div.contentEditable = "false";
  paint(div, code);
  return div;
}

function buildDecos(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (
      node.type.name === "code_block" &&
      String(node.attrs.language || "").toLowerCase() === "mermaid"
    ) {
      const code = node.textContent.trim();
      const end = pos + node.nodeSize;
      decos.push(
        Decoration.widget(end, () => makeWidget(code), {
          side: 1,
          key: `mmd:${code}`,
        }),
      );
    }
    return true;
  });
  return DecorationSet.create(doc, decos);
}

function mermaidPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: mermaidKey,
    state: {
      init: (_config, state) => buildDecos(state.doc),
      apply(tr, old) {
        return tr.docChanged ? buildDecos(tr.doc) : old.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations: (state) => mermaidKey.getState(state),
    },
  });
}

/** Attach the Mermaid plugin to the current editor view (idempotent). */
export function attachMermaid(view: EditorView | null, dark: boolean): void {
  if (!view) return;
  ensureInit(dark);
  if (mermaidKey.getState(view.state) !== undefined) return;
  view.updateState(
    view.state.reconfigure({
      plugins: view.state.plugins.concat(mermaidPlugin()),
    }),
  );
}

/** Switch diagram theme; clears the cache and re-renders live diagrams. */
export function setMermaidDark(dark: boolean): void {
  if (dark === currentDark && initialized) return;
  ensureInit(dark);
  cache.clear();
  document
    .querySelectorAll<HTMLElement>(".mermaid-render[data-mmd]")
    .forEach((div) => paint(div, div.dataset.mmd || ""));
}
