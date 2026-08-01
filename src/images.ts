import type { Editor } from "./editor";
import type { EditorView } from "@milkdown/kit/prose/view";
import { TextSelection } from "@milkdown/kit/prose/state";

/**
 * Image insertion via paste and drag & drop.
 *
 * v1 embeds images as base64 data URIs so they render immediately and travel
 * with the document — no asset-folder or file-protocol handling needed, and it
 * works identically in the browser and in Tauri. (A "save to ./assets" mode is
 * a natural future upgrade.)
 */

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function insertImage(view: EditorView, src: string, alt: string): boolean {
  const imageType = view.state.schema.nodes.image;
  if (!imageType) return false;
  const node = imageType.create({ src, alt });
  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
  return true;
}

function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  return [...data.files].filter((f) => f.type.startsWith("image/"));
}

export function enableImages(editor: Editor, editorRoot: HTMLElement): void {
  // Paste — intercept before ProseMirror's own handler when an image is present.
  editorRoot.addEventListener(
    "paste",
    (e) => {
      const files = imageFilesFrom(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const view = editor.getView();
      if (!view) return;
      void Promise.all(files.map(fileToDataUrl)).then((urls) => {
        urls.forEach((url, i) => insertImage(view, url, files[i].name));
      });
    },
    { capture: true },
  );

  // Allow dropping onto the editor.
  editorRoot.addEventListener("dragover", (e) => {
    if (imageFilesFrom(e.dataTransfer).length > 0) e.preventDefault();
  });

  editorRoot.addEventListener(
    "drop",
    (e) => {
      const files = imageFilesFrom(e.dataTransfer);
      if (files.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const view = editor.getView();
      if (!view) return;
      // Drop images at the cursor position under the pointer.
      const at = view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (at) {
        const sel = TextSelection.near(view.state.doc.resolve(at.pos));
        view.dispatch(view.state.tr.setSelection(sel));
      }
      void Promise.all(files.map(fileToDataUrl)).then((urls) => {
        urls.forEach((url, i) => insertImage(view, url, files[i].name));
      });
    },
    { capture: true },
  );
}
