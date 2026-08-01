import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import type { EditorView } from "@milkdown/kit/prose/view";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

export interface EditorCallbacks {
  onChange: (markdown: string) => void;
}

/**
 * Thin wrapper around Milkdown Crepe (a Typora-like WYSIWYG markdown editor).
 *
 * Crepe has no first-class "replace the whole document" API, so opening a file
 * tears down the instance and builds a fresh one. That's cheap and keeps the
 * undo history correctly scoped to a single document.
 */
export class Editor {
  private crepe: Crepe | null = null;
  private root: HTMLElement;
  private callbacks: EditorCallbacks;

  constructor(root: HTMLElement, callbacks: EditorCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
  }

  async load(markdown: string): Promise<void> {
    await this.destroy();

    const crepe = new Crepe({
      root: this.root,
      defaultValue: markdown,
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, md) => {
        this.callbacks.onChange(md);
      });
    });

    await crepe.create();
    this.crepe = crepe;
    crepe.setReadonly(false);
  }

  getMarkdown(): string {
    return this.crepe ? this.crepe.getMarkdown() : "";
  }

  /** The underlying ProseMirror view, or null before the editor is ready. */
  getView(): EditorView | null {
    if (!this.crepe) return null;
    try {
      return this.crepe.editor.action((ctx) => ctx.get(editorViewCtx));
    } catch {
      return null;
    }
  }

  focus(): void {
    const editable = this.root.querySelector<HTMLElement>(
      ".ProseMirror[contenteditable=true]",
    );
    editable?.focus();
  }

  async destroy(): Promise<void> {
    if (this.crepe) {
      await this.crepe.destroy();
      this.crepe = null;
    }
  }
}
