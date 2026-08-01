/**
 * Command palette (Ctrl+P): a searchable list of actions and — when a folder is
 * open — its markdown files, with keyboard navigation.
 */

export interface Command {
  id: string;
  title: string;
  hint?: string;
  run: () => void;
}

function score(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  const idx = t.indexOf(q);
  if (idx === 0) return 3;
  if (idx > 0) return 2;
  // subsequence match (fuzzy)
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 1 : 0;
}

export function openCommandPalette(commands: Command[]): void {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop palette-backdrop";

  const panel = document.createElement("div");
  panel.className = "palette-panel";

  const input = document.createElement("input");
  input.className = "palette-input";
  input.type = "text";
  input.placeholder = "Type a command or file…";
  input.spellcheck = false;

  const list = document.createElement("div");
  list.className = "palette-list";

  panel.append(input, list);
  backdrop.append(panel);
  document.body.append(backdrop);

  let filtered: Command[] = commands;
  let active = 0;

  const render = () => {
    list.replaceChildren();
    filtered.forEach((cmd, i) => {
      const row = document.createElement("div");
      row.className = "palette-row" + (i === active ? " active" : "");
      const title = document.createElement("span");
      title.className = "palette-title";
      title.textContent = cmd.title;
      row.append(title);
      if (cmd.hint) {
        const hint = document.createElement("span");
        hint.className = "palette-hint";
        hint.textContent = cmd.hint;
        row.append(hint);
      }
      row.addEventListener("mousemove", () => {
        if (active !== i) {
          active = i;
          paintActive();
        }
      });
      row.addEventListener("click", () => run(cmd));
      list.append(row);
    });
  };

  const paintActive = () => {
    [...list.children].forEach((el, i) =>
      el.classList.toggle("active", i === active),
    );
    list.children[active]?.scrollIntoView({ block: "nearest" });
  };

  const filter = () => {
    const q = input.value.trim();
    filtered = commands
      .map((c) => ({ c, s: score(q, c.title) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
    active = 0;
    render();
  };

  const run = (cmd: Command) => {
    close();
    cmd.run();
  };

  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKey, true);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      active = Math.min(active + 1, filtered.length - 1);
      paintActive();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      paintActive();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) run(filtered[active]);
    }
  };

  input.addEventListener("input", filter);
  document.addEventListener("keydown", onKey, true);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  render();
  input.focus();
}
