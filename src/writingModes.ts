import type { Editor } from "./editor";

/**
 * Focus mode and typewriter mode.
 *
 * - Focus: dims every top-level block except the one holding the caret.
 * - Typewriter: keeps the caret line vertically centered in the viewport.
 *
 * Both react to caret movement, which we observe through cheap DOM events
 * (keyup / pointerup / input) rather than a ProseMirror plugin.
 */
export class WritingModes {
  private editor: Editor;
  private root: HTMLElement; // the scrolling #editor container
  private focus = false;
  private typewriter = false;
  private activeBlock: HTMLElement | null = null;

  constructor(editor: Editor, root: HTMLElement) {
    this.editor = editor;
    this.root = root;
    const onCursor = () => this.update();
    this.root.addEventListener("keyup", onCursor);
    this.root.addEventListener("pointerup", onCursor);
    this.root.addEventListener("input", onCursor);
  }

  setModes(focus: boolean, typewriter: boolean): void {
    this.focus = focus;
    this.typewriter = typewriter;
    this.root.classList.toggle("tm-focus", focus);
    this.root.classList.toggle("tm-typewriter", typewriter);
    if (!focus) this.clearActive();
    this.update();
  }

  /** Recompute after the document is reloaded (fresh DOM). */
  refresh(): void {
    this.activeBlock = null;
    this.update();
  }

  private clearActive(): void {
    this.activeBlock?.classList.remove("tm-active");
    this.activeBlock = null;
  }

  private update(): void {
    if (this.focus) this.markActiveBlock();
    if (this.typewriter) this.centerCaret();
  }

  private markActiveBlock(): void {
    const pm = this.root.querySelector(".ProseMirror");
    if (!pm) return;
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode ?? null;

    // Climb to the direct child of .ProseMirror that contains the caret.
    let block: HTMLElement | null = null;
    while (node && node !== pm) {
      if (node.parentNode === pm) {
        block = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }
    if (block === this.activeBlock) return;
    this.activeBlock?.classList.remove("tm-active");
    block?.classList?.add("tm-active");
    this.activeBlock = block;
  }

  private centerCaret(): void {
    const view = this.editor.getView();
    if (!view) return;
    const head = view.state.selection.head;
    const coords = view.coordsAtPos(head);
    const box = this.root.getBoundingClientRect();
    const caretMid = (coords.top + coords.bottom) / 2;
    const target = box.top + box.height / 2;
    const delta = caretMid - target;
    if (Math.abs(delta) > 1) this.root.scrollTop += delta;
  }
}
