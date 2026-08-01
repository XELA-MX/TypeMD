import type { FileNode } from "./files";
import { icons } from "./icons";

export type SidebarAction = "newFile" | "newFolder" | "rename" | "delete";

/**
 * Collapsible folder tree. Reports the path of any file the user opens, and
 * emits context-menu actions (new/rename/delete) for main to carry out.
 */
export class Sidebar {
  private treeEl: HTMLElement;
  private headerEl: HTMLElement;
  private onOpenFile: (path: string) => void;
  private onAction: (action: SidebarAction, node: FileNode | null) => void;
  private activePath: string | null = null;
  private expanded = new Set<string>();
  private tree: FileNode[] = [];
  private nodeOf = new Map<HTMLElement, FileNode>();
  private menu: HTMLElement | null = null;

  constructor(
    root: HTMLElement,
    header: HTMLElement,
    onOpenFile: (path: string) => void,
    onAction: (action: SidebarAction, node: FileNode | null) => void,
  ) {
    this.treeEl = root;
    this.headerEl = header;
    this.onOpenFile = onOpenFile;
    this.onAction = onAction;
    document.addEventListener("click", () => this.closeMenu());
  }

  setFolder(name: string, tree: FileNode[]): void {
    this.headerEl.textContent = name;
    this.headerEl.title = name;
    this.expanded = new Set(tree.filter((n) => n.isDir).map((n) => n.path));
    this.tree = tree;
    this.render();
  }

  /** Re-render a refreshed tree, keeping the current expand/collapse state. */
  updateTree(tree: FileNode[]): void {
    this.tree = tree;
    this.render();
  }

  setActive(path: string | null): void {
    this.activePath = path;
    this.treeEl.querySelectorAll<HTMLElement>(".tree-file").forEach((el) => {
      el.classList.toggle("active", el.dataset.path === path);
    });
  }

  private render(): void {
    this.treeEl.replaceChildren();
    this.nodeOf.clear();
    if (this.tree.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tree-empty";
      empty.textContent = "No markdown files here.";
      this.treeEl.append(empty);
      return;
    }
    this.treeEl.append(this.buildLevel(this.tree, 0));
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
    this.nodeOf.set(row, node);

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
    row.addEventListener("contextmenu", (e) => this.openMenu(e, node));

    wrap.append(row, childrenWrap);
    return wrap;
  }

  private buildFile(node: FileNode, depth: number): HTMLElement {
    const row = document.createElement("div");
    row.className = "tree-row tree-file";
    row.dataset.path = node.path;
    row.style.paddingLeft = `${8 + depth * 14 + 16}px`;
    if (node.path === this.activePath) row.classList.add("active");
    this.nodeOf.set(row, node);

    const label = document.createElement("span");
    label.className = "tree-label";
    label.textContent = node.name;
    row.append(label);

    row.addEventListener("click", () => this.onOpenFile(node.path));
    row.addEventListener("contextmenu", (e) => this.openMenu(e, node));
    return row;
  }

  // --- Context menu --------------------------------------------------------

  private closeMenu(): void {
    this.menu?.remove();
    this.menu = null;
  }

  private openMenu(e: MouseEvent, node: FileNode): void {
    e.preventDefault();
    e.stopPropagation();
    this.closeMenu();

    const items: [string, SidebarAction][] = node.isDir
      ? [
          ["New file", "newFile"],
          ["New folder", "newFolder"],
          ["Rename", "rename"],
          ["Delete", "delete"],
        ]
      : [
          ["Rename", "rename"],
          ["Delete", "delete"],
        ];

    const menu = document.createElement("div");
    menu.className = "ctx-menu";
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    for (const [label, action] of items) {
      const item = document.createElement("div");
      item.className = "ctx-item" + (action === "delete" ? " danger" : "");
      item.textContent = label;
      item.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.closeMenu();
        this.onAction(action, node);
      });
      menu.append(item);
    }
    document.body.append(menu);
    this.menu = menu;
  }
}
