import type { Editor } from "./editor";

/**
 * Raw markdown source view. Swaps the WYSIWYG editor for a plain textarea
 * holding the document's markdown, and syncs the edits back on exit.
 */
export class SourceMode {
  private editor: Editor;
  private editorRoot: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private reload: (md: string) => Promise<void>;
  private onEdit: () => void;
  private active = false;

  constructor(
    editor: Editor,
    editorRoot: HTMLElement,
    textarea: HTMLTextAreaElement,
    reload: (md: string) => Promise<void>,
    onEdit: () => void,
  ) {
    this.editor = editor;
    this.editorRoot = editorRoot;
    this.textarea = textarea;
    this.reload = reload;
    this.onEdit = onEdit;
    this.textarea.addEventListener("input", () => this.onEdit());
  }

  isActive(): boolean {
    return this.active;
  }

  /** Markdown from whichever surface is currently authoritative. */
  currentMarkdown(): string {
    return this.active ? this.textarea.value : this.editor.getMarkdown();
  }

  private enter(): void {
    this.textarea.value = this.editor.getMarkdown();
    this.editorRoot.hidden = true;
    this.textarea.hidden = false;
    this.textarea.focus();
    this.active = true;
  }

  private async exit(): Promise<void> {
    const md = this.textarea.value;
    this.textarea.hidden = true;
    this.editorRoot.hidden = false;
    this.active = false;
    await this.reload(md);
    this.editor.focus();
  }

  async toggle(): Promise<void> {
    if (this.active) await this.exit();
    else this.enter();
  }
}
