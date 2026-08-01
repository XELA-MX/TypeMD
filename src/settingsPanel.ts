import type { Settings, LineWidth } from "./settings";
import type { SoundLevel } from "./keysound";
import { THEME_OPTIONS } from "./themes";
import { icons } from "./icons";

/**
 * Modal settings panel. Changes apply live via `onChange` (which is also
 * responsible for persisting). Close with the X button, the backdrop, or Esc.
 */
export function openSettingsPanel(
  current: Settings,
  onChange: (next: Settings) => void,
): void {
  let settings = { ...current };

  const update = (patch: Partial<Settings>) => {
    settings = { ...settings, ...patch };
    onChange(settings);
  };

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const panel = document.createElement("div");
  panel.className = "modal-panel";

  // Header
  const header = document.createElement("div");
  header.className = "modal-header";
  const title = document.createElement("h2");
  title.textContent = "Settings";
  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.innerHTML = icons.close;
  header.append(title, closeBtn);

  const body = document.createElement("div");
  body.className = "modal-body";

  body.append(
    section("Appearance", [
      row(
        "Theme",
        select(
          THEME_OPTIONS.map((t) => [t.id, t.name] as [string, string]),
          settings.theme,
          (v) => update({ theme: v }),
        ),
      ),
    ]),
    section("Editor", [
      row(
        "Line width",
        segmented<LineWidth>(
          [
            ["narrow", "Narrow"],
            ["medium", "Medium"],
            ["wide", "Wide"],
          ],
          settings.lineWidth,
          (v) => update({ lineWidth: v }),
        ),
      ),
      row(
        "Font size",
        stepper(settings.fontSize, 12, 24, (v) => update({ fontSize: v })),
      ),
      row(
        "Focus mode (dim inactive text)",
        toggle(settings.focusMode, (v) => update({ focusMode: v })),
      ),
      row(
        "Typewriter mode (center the caret)",
        toggle(settings.typewriterMode, (v) => update({ typewriterMode: v })),
      ),
    ]),
    section("Sound", [
      row(
        "Mechanical keyboard sound",
        toggle(settings.keySound, (v) => update({ keySound: v })),
      ),
      row(
        "Sound volume",
        segmented<SoundLevel>(
          [
            ["soft", "Soft"],
            ["medium", "Medium"],
            ["loud", "Loud"],
          ],
          settings.keySoundLevel,
          (v) => update({ keySoundLevel: v }),
        ),
      ),
    ]),
    section("Behavior", [
      row(
        "Autosave",
        toggle(settings.autosave, (v) => update({ autosave: v })),
      ),
      row(
        "Confirm before discarding unsaved changes",
        toggle(settings.confirmOnClose, (v) => update({ confirmOnClose: v })),
      ),
      row(
        "Reopen last file on startup",
        toggle(settings.restoreLast, (v) => update({ restoreLast: v })),
      ),
    ]),
  );

  panel.append(header, body);
  backdrop.append(panel);
  document.body.append(backdrop);

  // --- close handling ---
  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", onKey);
}

// --- small builders --------------------------------------------------------

function section(heading: string, rows: HTMLElement[]): HTMLElement {
  const sec = document.createElement("section");
  sec.className = "settings-section";
  const h = document.createElement("h3");
  h.textContent = heading;
  sec.append(h, ...rows);
  return sec;
}

function row(label: string, control: HTMLElement): HTMLElement {
  const r = document.createElement("div");
  r.className = "settings-row";
  const l = document.createElement("span");
  l.className = "settings-label";
  l.textContent = label;
  r.append(l, control);
  return r;
}

function segmented<T extends string>(
  options: [T, string][],
  value: T,
  onPick: (v: T) => void,
): HTMLElement {
  const group = document.createElement("div");
  group.className = "segmented";
  for (const [val, text] of options) {
    const btn = document.createElement("button");
    btn.className = "segmented-btn";
    btn.textContent = text;
    btn.classList.toggle("active", val === value);
    btn.addEventListener("click", () => {
      group
        .querySelectorAll(".segmented-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onPick(val);
    });
    group.append(btn);
  }
  return group;
}

function select(
  options: [string, string][],
  value: string,
  onPick: (v: string) => void,
): HTMLElement {
  const el = document.createElement("select");
  el.className = "settings-select";
  for (const [val, text] of options) {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = text;
    if (val === value) opt.selected = true;
    el.append(opt);
  }
  el.addEventListener("change", () => onPick(el.value));
  return el;
}

function stepper(
  value: number,
  min: number,
  max: number,
  onChange: (v: number) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "stepper";
  const dec = document.createElement("button");
  dec.className = "stepper-btn";
  dec.textContent = "−";
  const out = document.createElement("span");
  out.className = "stepper-value";
  const inc = document.createElement("button");
  inc.className = "stepper-btn";
  inc.textContent = "+";

  let current = value;
  const paint = () => (out.textContent = `${current}px`);
  paint();

  dec.addEventListener("click", () => {
    current = Math.max(min, current - 1);
    paint();
    onChange(current);
  });
  inc.addEventListener("click", () => {
    current = Math.min(max, current + 1);
    paint();
    onChange(current);
  });

  wrap.append(dec, out, inc);
  return wrap;
}

function toggle(value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const btn = document.createElement("button");
  btn.className = "toggle";
  btn.setAttribute("role", "switch");
  btn.setAttribute("aria-checked", String(value));
  btn.classList.toggle("on", value);
  const knob = document.createElement("span");
  knob.className = "toggle-knob";
  btn.append(knob);

  btn.addEventListener("click", () => {
    const next = !btn.classList.contains("on");
    btn.classList.toggle("on", next);
    btn.setAttribute("aria-checked", String(next));
    onChange(next);
  });
  return btn;
}
