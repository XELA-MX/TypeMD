import type { Editor } from "./editor";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorView } from "@milkdown/kit/prose/view";
import { setIcon } from "./icons";

/**
 * Find & replace over the live ProseMirror document. Matches are highlighted
 * with decorations (so they show even while the find box holds focus), and the
 * current match is scrolled into view. Uses Milkdown's bundled ProseMirror so
 * plugin/state instances match the editor's.
 */

const searchKey = new PluginKey<DecorationSet>("typemd-search");

function searchPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: searchKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, old) {
        const meta = tr.getMeta(searchKey) as DecorationSet | undefined;
        if (meta) return meta;
        return old.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations: (state) => searchKey.getState(state),
    },
  });
}

interface Match {
  from: number;
  to: number;
}

interface Els {
  bar: HTMLElement;
  findInput: HTMLInputElement;
  replaceInput: HTMLInputElement;
  count: HTMLElement;
  prev: HTMLElement;
  next: HTMLElement;
  close: HTMLElement;
  replaceOne: HTMLElement;
  replaceAll: HTMLElement;
}

export class FindReplace {
  private editor: Editor;
  private els: Els;
  private matches: Match[] = [];
  private current = -1;

  constructor(editor: Editor, els: Els) {
    this.editor = editor;
    this.els = els;
    this.wire();
  }

  private wire(): void {
    setIcon(this.els.prev, "arrowUp");
    setIcon(this.els.next, "arrowDown");
    setIcon(this.els.close, "close");

    this.els.findInput.addEventListener("input", () => this.runSearch());
    this.els.findInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.shiftKey ? this.prev() : this.next();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });
    this.els.replaceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.replaceCurrent();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });

    this.els.prev.addEventListener("click", () => this.prev());
    this.els.next.addEventListener("click", () => this.next());
    this.els.close.addEventListener("click", () => this.close());
    this.els.replaceOne.addEventListener("click", () => this.replaceCurrent());
    this.els.replaceAll.addEventListener("click", () => this.replaceAll());
  }

  // --- visibility ----------------------------------------------------------

  open(): void {
    this.els.bar.hidden = false;
    const view = this.editor.getView();
    const selected = view?.state.selection;
    if (view && selected && !selected.empty) {
      const text = view.state.doc.textBetween(selected.from, selected.to);
      if (text && !text.includes("\n")) this.els.findInput.value = text;
    }
    this.els.findInput.focus();
    this.els.findInput.select();
    this.runSearch();
  }

  close(): void {
    this.els.bar.hidden = true;
    this.clearHighlights();
    this.editor.focus();
  }

  toggle(): void {
    if (this.els.bar.hidden) this.open();
    else this.close();
  }

  // --- search --------------------------------------------------------------

  private ensurePlugin(view: EditorView): void {
    if (searchKey.getState(view.state) !== undefined) return;
    view.updateState(
      view.state.reconfigure({
        plugins: view.state.plugins.concat(searchPlugin()),
      }),
    );
  }

  private runSearch(): void {
    const view = this.editor.getView();
    const query = this.els.findInput.value;
    this.matches = [];

    if (view && query) {
      this.ensurePlugin(view);
      const needle = query.toLowerCase();
      view.state.doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          const hay = node.text.toLowerCase();
          let idx = hay.indexOf(needle);
          while (idx !== -1) {
            this.matches.push({
              from: pos + idx,
              to: pos + idx + query.length,
            });
            idx = hay.indexOf(needle, idx + query.length);
          }
        }
        return true;
      });
    }

    this.current = this.matches.length ? 0 : -1;
    this.paint(true);
  }

  private paint(scroll: boolean): void {
    const view = this.editor.getView();
    this.updateCount();
    if (!view) return;

    const decos = this.matches.map((m, i) =>
      Decoration.inline(m.from, m.to, {
        class: i === this.current ? "search-current" : "search-match",
      }),
    );
    const set = DecorationSet.create(view.state.doc, decos);
    view.dispatch(view.state.tr.setMeta(searchKey, set));

    if (scroll && this.current >= 0) this.scrollToCurrent(view);
  }

  private scrollToCurrent(view: EditorView): void {
    const m = this.matches[this.current];
    const at = view.domAtPos(m.from).node;
    const el = at.nodeType === Node.TEXT_NODE ? at.parentElement : (at as HTMLElement);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  private clearHighlights(): void {
    const view = this.editor.getView();
    if (view && searchKey.getState(view.state) !== undefined) {
      view.dispatch(view.state.tr.setMeta(searchKey, DecorationSet.empty));
    }
  }

  private updateCount(): void {
    const n = this.matches.length;
    this.els.count.textContent = n ? `${this.current + 1}/${n}` : "0/0";
  }

  next(): void {
    if (!this.matches.length) return;
    this.current = (this.current + 1) % this.matches.length;
    this.paint(true);
  }

  prev(): void {
    if (!this.matches.length) return;
    this.current =
      (this.current - 1 + this.matches.length) % this.matches.length;
    this.paint(true);
  }

  // --- replace -------------------------------------------------------------

  private replaceCurrent(): void {
    const view = this.editor.getView();
    if (!view || this.current < 0) return;
    const m = this.matches[this.current];
    const at = this.current;
    view.dispatch(view.state.tr.insertText(this.els.replaceInput.value, m.from, m.to));
    this.runSearch();
    // Stay near the same spot in the (now shorter) result list.
    if (this.matches.length) {
      this.current = Math.min(at, this.matches.length - 1);
      this.paint(true);
    }
  }

  private replaceAll(): void {
    const view = this.editor.getView();
    if (!view || !this.matches.length) return;
    const replacement = this.els.replaceInput.value;
    let tr = view.state.tr;
    // Apply from the end so earlier positions stay valid.
    for (const m of [...this.matches].sort((a, b) => b.from - a.from)) {
      tr = tr.insertText(replacement, m.from, m.to);
    }
    view.dispatch(tr);
    this.runSearch();
  }
}
