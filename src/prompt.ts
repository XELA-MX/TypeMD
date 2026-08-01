/**
 * Small modal prompt for a single line of text (e.g. a new file name).
 * Resolves to the trimmed value, or null if cancelled.
 */
export function promptModal(
  title: string,
  defaultValue = "",
  confirmLabel = "OK",
): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const panel = document.createElement("div");
    panel.className = "modal-panel prompt-panel";

    const h = document.createElement("h2");
    h.className = "prompt-title";
    h.textContent = title;

    const input = document.createElement("input");
    input.className = "prompt-input";
    input.type = "text";
    input.value = defaultValue;
    input.spellcheck = false;

    const actions = document.createElement("div");
    actions.className = "prompt-actions";
    const cancel = document.createElement("button");
    cancel.className = "prompt-btn";
    cancel.textContent = "Cancel";
    const ok = document.createElement("button");
    ok.className = "prompt-btn primary";
    ok.textContent = confirmLabel;
    actions.append(cancel, ok);

    panel.append(h, input, actions);
    backdrop.append(panel);
    document.body.append(backdrop);

    const done = (value: string | null) => {
      backdrop.remove();
      document.removeEventListener("keydown", onKey, true);
      resolve(value);
    };
    const submit = () => {
      const v = input.value.trim();
      done(v || null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        done(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };

    ok.addEventListener("click", submit);
    cancel.addEventListener("click", () => done(null));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) done(null);
    });
    document.addEventListener("keydown", onKey, true);

    input.focus();
    // Select the base name (before extension) for quick renaming.
    const dot = defaultValue.lastIndexOf(".");
    input.setSelectionRange(0, dot > 0 ? dot : defaultValue.length);
  });
}
