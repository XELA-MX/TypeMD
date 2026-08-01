import type { FileNode } from "./files";
import { icons } from "./icons";

/**
 * Collapsible folder tree. Renders a set of `FileNode`s and reports the path
 * of any file the user clicks. Folders toggle open/closed in place.
 */
export class Sidebar {
  private treeEl: HTMLElement;
  private headerEl: HTMLElement;
  private onOpenFile: (path: string) => void;
  private activePath: string | null = null;
  private expanded = new Set<string>();

  constructor(
    root: HTMLElement,
    header: HTMLElement,
    onOpenFile: (path: string) => void,
  ) {
    this.treeEl = root;
    this.headerEl = header;
    this.onOpenFile = onOpenFile;
  }

  setFolder(name: string, tree: FileNode[]): void {
    this.headerEl.textContent = name;
    this.headerEl.title = name;
    // Expand top-level folders by default for quick orientation.
    this.expanded = new Set(tree.filter((n) => n.isDir).map((n) => n.path));
    this.render(tree);
  }

  setActive(path: string | null): void {
    this.activePath = path;
    this.treeEl.querySelectorAll<HTMLElement>(".tree-file").forEach((el) => {
      el.classList.toggle("active", el.dataset.path === path);
    });
  }

  private render(tree: FileNode[]): void {
    this.treeEl.replaceChildren();
    if (tree.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tree-empty";
      empty.textContent = "No markdown files here.";
      this.treeEl.append(empty);
      return;
    }
    this.treeEl.append(this.buildLevel(tree, 0));
  }

  private buildLevel(nodes: FileNode[], depth: number): DocumentFragment {
    const frag = document.createDocumentFragment();
    for (const node of nodes) {
      frag.append(
        node.isDir ? this.buildDir(node, depth) : this.buildFile(node, depth),
      );
    }
    return frag;
  }

  private buildDir(node: FileNode, depth: number): HTMLElement {
    const wrap = document.createElement("div");

    const row = document.createElement("div");
    row.className = "tree-row tree-dir";
    row.style.paddingLeft = `${8 + depth * 14}px`;

    const chevron = document.createElement("span");
    chevron.className = "tree-chevron";
    chevron.innerHTML = icons.chevron;

    const label = document.createElement("span");
    label.className = "tree-label";
    label.textContent = node.name;

    row.append(chevron, label);

    const childrenWrap = document.createElement("div");
    childrenWrap.append(this.buildLevel(node.children ?? [], depth + 1));

    const isOpen = this.expanded.has(node.path);
    row.classList.toggle("open", isOpen);
    childrenWrap.hidden = !isOpen;

    row.addEventListener("click", () => {
      const open = !this.expanded.has(node.path);
      if (open) this.expanded.add(node.path);
      else this.expanded.delete(node.path);
      row.classList.toggle("open", open);
      childrenWrap.hidden = !open;
    });

    wrap.append(row, childrenWrap);
    return wrap;
  }

  private buildFile(node: FileNode, depth: number): HTMLElement {
    const row = document.createElement("div");
    row.className = "tree-row tree-file";
    row.dataset.path = node.path;
    row.style.paddingLeft = `${8 + depth * 14 + 16}px`;
    if (node.path === this.activePath) row.classList.add("active");

    const label = document.createElement("span");
    label.className = "tree-label";
    label.textContent = node.name;
    row.append(label);

    row.addEventListener("click", () => this.onOpenFile(node.path));
    return row;
  }
}
