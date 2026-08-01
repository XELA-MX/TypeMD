# TypeMD

A minimalist, modern **WYSIWYG markdown editor** for Linux — a lightweight
alternative to Typora. Built with **Tauri 2** (Rust + system WebView) and
**Milkdown Crepe** (a ProseMirror-based live-preview markdown editor).

- ✍️ True WYSIWYG editing — markdown transforms inline as you type
- 🪶 Tiny footprint — native binary, no bundled browser
- 🌗 Automatic light/dark theme
- 💾 Open/save `.md` files with native dialogs

## Requirements (Fedora Workstation)

Install the Rust toolchain and the WebKitGTK build dependencies:

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# Tauri system dependencies
sudo dnf install -y webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel gcc gcc-c++ make \
  rpm-build patchelf
```

Node.js 18+ is also required (you have it).

## Development

```bash
npm install          # once
npm run tauri dev    # native app with hot reload
```

For quick UI iteration without Rust, you can also run just the frontend in a
browser (file I/O is stubbed to browser upload/download):

```bash
npm run dev          # http://localhost:1420
```

## Build a release package

```bash
npm run tauri build  # produces an .rpm, .deb and AppImage in src-tauri/target/release/bundle/
```

## Keyboard shortcuts

| Shortcut   | Action        |
| ---------- | ------------- |
| `Ctrl + N` | New document  |
| `Ctrl + O` | Open file     |
| `Ctrl + S` | Save          |

## Project layout

```
src/                Frontend (TypeScript + Vite)
  editor.ts         Milkdown Crepe wrapper
  files.ts          File I/O (Tauri native + browser fallback)
  main.ts           App orchestration, shortcuts, chrome
  styles.css        Minimalist theming
src-tauri/          Native shell (Rust / Tauri)
```

## License

MIT
