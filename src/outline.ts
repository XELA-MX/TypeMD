/**
 * Document outline: lists the headings in the editor and scrolls to them on
 * click. Rebuilt from the rendered DOM whenever the document changes, with a
 * scroll-spy that highlights the heading currently in view.
 */

interface HeadingRef {
  el: HTMLElement;
  level: number;
  text: string;
}

export class Outline {
  private listEl: HTMLElement;
  private editorRoot: HTMLElement;
  private headings: HeadingRef[] = [];
  private rowFor = new Map<HTMLElement, HTMLElement>();
  private observer: IntersectionObserver | null = null;

  constructor(listEl: HTMLElement, editorRoot: HTMLElement) {
    this.listEl = listEl;
    this.editorRoot = editorRoot;
  }

  /** Rescan headings from the editor DOM and rebuild the list. */
  rebuild(): void {
    const nodes = this.editorRoot.querySelectorAll<HTMLElement>(
      ".ProseMirror :is(h1, h2, h3, h4, h5, h6)",
    );
    this.headings = [...nodes].map((el) => ({
      el,
      level: Number(el.tagName[1]),
      text: el.textContent?.trim() || "Untitled",
    }));
    this.render();
    this.observe();
  }

  private render(): void {
    this.listEl.replaceChildren();
    this.rowFor.clear();

    if (this.headings.length === 0) {
      const empty = document.createElement("div");
      empty.className = "outline-empty";
      empty.textContent = "No headings yet.";
      this.listEl.append(empty);
      return;
    }

    const minLevel = Math.min(...this.headings.map((h) => h.level));
    for (const h of this.headings) {
      const row = document.createElement("div");
      row.className = "outline-row";
      row.textContent = h.text;
      row.title = h.text;
      row.style.paddingLeft = `${12 + (h.level - minLevel) * 14}px`;
      row.addEventListener("click", () => {
        h.el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      this.rowFor.set(h.el, row);
      this.listEl.append(row);
    }
  }

  private observe(): void {
    this.observer?.disconnect();
    if (this.headings.length === 0) return;

    const scroller = this.editorRoot; // the scrolling container
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const row = this.rowFor.get(entry.target as HTMLElement);
          if (!row) continue;
          this.listEl
            .querySelectorAll(".outline-row.active")
            .forEach((r) => r.classList.remove("active"));
          row.classList.add("active");
        }
      },
      { root: scroller, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    this.headings.forEach((h) => this.observer!.observe(h.el));
  }
}
