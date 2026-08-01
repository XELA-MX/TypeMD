<div align="center">

# TypeMD

**A minimalist, modern WYSIWYG markdown editor for Linux — a lightweight, open alternative to Typora.**

Built with [Tauri 2](https://tauri.app) (Rust + the system WebView) and
[Milkdown Crepe](https://milkdown.dev) (a ProseMirror live-preview editor).

</div>

---

## Why TypeMD

Markdown transforms **inline as you type** — `##` becomes a heading, `**bold**`
becomes **bold**, `- [ ]` becomes a task — so you get a clean document, never a
split "source / preview" pane. It ships as a small native binary (no bundled
Chromium), starts fast, and stays out of your way.

## Features

### Editing
- ✍️ **True WYSIWYG** live-preview markdown (Typora-style)
- 🎨 **Syntax highlighting** in code blocks (CodeMirror, loads on edit)
- 📊 **Tables** with an inline cell editor
- ∑ **Math** — inline `$…$` LaTeX rendered with KaTeX
- 🧜 **Mermaid diagrams** — ` ```mermaid ` blocks render live as SVG (cached,
  theme-aware, with inline syntax-error reporting)
- 🦶 **Footnotes**
- 🖼️ **Images** — paste from clipboard or drag & drop (embedded as data URIs)
- `</>` **Source mode** — drop to raw markdown any time (`Ctrl+/`)

### Workspace
- 📁 **Folder sidebar** with a collapsible file tree
- 🗂️ **File operations** — create / rename / delete files & folders (context menu
  + header buttons)
- 🧭 **Outline / TOC** panel with scroll-spy (`Ctrl+Shift+K`)
- 🔎 **Find & replace** with match highlighting (`Ctrl+F`)
- ⌘ **Command palette** — fuzzy-search every action and file (`Ctrl+P`)
- 📤 **Export** to HTML and PDF (`Ctrl+E`)
- 💾 **Open / save** `.md` with native dialogs, plus optional **autosave**

### Feel
- 🌗 **Themes** — System, Light, Dark, Nord, Solarized Light, Rosé Pine (each
  reskins the chrome *and* the editor)
- 🪟 **Frameless window** with a custom, draggable title bar and window controls
- 🎯 **Focus mode** (dim inactive text) and **typewriter mode** (centered caret)
- 🎹 **Mechanical-keyboard typing sound**, synthesized live (no audio files) —
  toggle and volume in settings
- ⚙️ All preferences persist between sessions

## Requirements (Fedora Workstation)

Node.js 18+, the Rust toolchain, and the WebKitGTK build dependencies:

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# Tauri system dependencies
sudo dnf install -y webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel gcc gcc-c++ make \
  rpm-build patchelf
```

> On other distros install the equivalent `webkit2gtk` 4.1 dev packages — see
> the [Tauri Linux prerequisites](https://tauri.app/start/prerequisites/).

## Development

```bash
npm install          # once
npm run tauri dev    # native app with hot reload
```

For quick UI iteration without Rust, run just the frontend in a browser — file
and folder access degrade gracefully (upload/download; folder browsing is
native-only):

```bash
npm run dev          # http://localhost:1420
```

## Build a release package

```bash
npm run tauri build  # .rpm, .deb and AppImage in src-tauri/target/release/bundle/
```

## Keyboard shortcuts

| Shortcut           | Action                    |
| ------------------ | ------------------------- |
| `Ctrl + N`         | New file                  |
| `Ctrl + O`         | Open file                 |
| `Ctrl + Shift + O` | Open folder               |
| `Ctrl + S`         | Save                      |
| `Ctrl + P`         | Command palette           |
| `Ctrl + F`         | Find & replace            |
| `Ctrl + E`         | Export (HTML / PDF)       |
| `Ctrl + /`         | Toggle source view        |
| `Ctrl + B`         | Toggle sidebar            |
| `Ctrl + Shift + K` | Toggle outline            |
| `Ctrl + ,`         | Settings                  |

## Tech stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Shell      | Tauri 2 (Rust) — native window, `fs` + `dialog`    |
| Build      | Vite + TypeScript                                  |
| Editor     | Milkdown Crepe (ProseMirror)                       |
| Rendering  | KaTeX (math), Mermaid (diagrams), marked (export)  |
| Sound      | Web Audio API (synthesized)                        |

## Project layout

```
index.html               App shell markup
src/                     Frontend (TypeScript + Vite)
  main.ts                Orchestration: state, shortcuts, wiring
  editor.ts              Milkdown Crepe wrapper + ProseMirror view access
  files.ts               File I/O, folder tree, fs operations
  sidebar.ts             Folder tree + context-menu file actions
  outline.ts             Heading outline with scroll-spy
  findReplace.ts         Find & replace (ProseMirror decorations)
  export.ts              HTML / PDF export
  images.ts              Paste & drag-drop image insertion
  mermaidView.ts         Live Mermaid diagram rendering
  sourceMode.ts          Raw-markdown source view
  writingModes.ts        Focus & typewriter modes
  commandPalette.ts      Ctrl+P palette
  settings.ts            Settings model, persistence, theme resolution
  settingsPanel.ts       Settings modal UI
  themes.ts              Named color themes (skins)
  keysound.ts            Mechanical typing sound (Web Audio)
  prompt.ts              Small text-prompt modal
  icons.ts               Inline SVG icons
  styles.css             Theming and layout
src-tauri/               Native shell (Rust / Tauri)
  src/                   Rust entry points
  tauri.conf.json        Window, bundle and build config
  capabilities/          Permission grants (fs, dialog, window)
```

## Notes

- **PDF export** opens the system print dialog — choose *Print to File / Save as
  PDF*.
- **Images** are embedded inline as base64 data URIs (portable; a "save to
  `./assets`" mode is a planned option).
- Settings are stored in the WebView's local storage.

## Roadmap

- Native OS integration: `.md` file associations, `typemd file.md` from the CLI,
  single-instance, and reload-on-external-change
- Wiki-links `[[note]]` with backlinks
- Full-text search across the open folder
- Git integration, frontmatter/tags, snippets
- `save to ./assets` image mode and DOCX export (via `pandoc`)

## License

MIT
