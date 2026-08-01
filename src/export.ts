import { marked } from "marked";
import { icons } from "./icons";
import { isTauri } from "./files";

/**
 * Document export. Markdown is rendered to clean, self-contained HTML with an
 * embedded print stylesheet. From there:
 *  - "HTML" writes a standalone .html file.
 *  - "PDF" renders the same document in a hidden frame and opens the print
 *    dialog (choose "Save as PDF" / "Print to File").
 */

marked.setOptions({ gfm: true, breaks: false });

const PRINT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    max-width: 760px;
    margin: 40px auto;
    padding: 0 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.7;
    color: #1a1a1a;
    background: #fff;
  }
  h1, h2, h3, h4 { line-height: 1.3; margin: 1.6em 0 0.6em; }
  h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
  h1, h2 { border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  p, ul, ol, blockquote, table, pre { margin: 0 0 1em; }
  a { color: #4c6ef5; }
  code {
    font-family: "Space Mono", ui-monospace, Menlo, Consolas, monospace;
    font-size: 0.9em;
    background: #f2f2f2;
    padding: 0.15em 0.4em;
    border-radius: 4px;
  }
  pre {
    background: #f6f8fa;
    padding: 14px 16px;
    border-radius: 8px;
    overflow-x: auto;
  }
  pre code { background: none; padding: 0; }
  blockquote {
    margin-left: 0;
    padding-left: 1em;
    border-left: 3px solid #dcdcdc;
    color: #555;
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 6px 12px; }
  th { background: #f6f8fa; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid #e5e5e5; margin: 2em 0; }
  @page { margin: 18mm; }
`;

async function renderDoc(markdown: string, title: string): Promise<string> {
  const body = await marked.parse(markdown);
  const safeTitle = title.replace(/[<>&]/g, "");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

async function saveHtml(html: string, baseName: string): Promise<boolean> {
  const fileName = `${stripExt(baseName)}.html`;
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: fileName,
      filters: [{ name: "HTML", extensions: ["html"] }],
    });
    if (!path) return false;
    await writeTextFile(path, html);
    return true;
  }
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

function printDoc(html: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });
  document.body.append(frame);

  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1500);
  };
}

/** Show a small dialog offering HTML or PDF export. */
export function openExportDialog(markdown: string, docName: string): void {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const panel = document.createElement("div");
  panel.className = "modal-panel export-panel";

  const header = document.createElement("div");
  header.className = "modal-header";
  const title = document.createElement("h2");
  title.textContent = "Export";
  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.innerHTML = icons.close;
  header.append(title, closeBtn);

  const body = document.createElement("div");
  body.className = "modal-body export-choices";

  const makeChoice = (label: string, hint: string, onPick: () => void) => {
    const btn = document.createElement("button");
    btn.className = "export-choice";
    btn.innerHTML = `${icons.download}<span class="export-choice-label">${label}</span><span class="export-choice-hint">${hint}</span>`;
    btn.addEventListener("click", () => {
      close();
      onPick();
    });
    return btn;
  };

  body.append(
    makeChoice("PDF", "Opens the print dialog", () =>
      void renderDoc(markdown, docName).then(printDoc),
    ),
    makeChoice("HTML", "Self-contained .html file", () =>
      void renderDoc(markdown, docName).then((h) => saveHtml(h, docName)),
    ),
  );

  panel.append(header, body);
  backdrop.append(panel);
  document.body.append(backdrop);

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
