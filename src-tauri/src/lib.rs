use tauri::{Emitter, Manager};

/// The first non-flag CLI argument, if it looks like a file path.
fn file_arg(argv: &[String]) -> Option<String> {
    argv.iter()
        .skip(1)
        .find(|a| !a.starts_with('-'))
        .cloned()
}

/// Path passed on the command line to this instance (e.g. `typemd note.md`).
#[tauri::command]
fn initial_file() -> Option<String> {
    file_arg(&std::env::args().collect::<Vec<_>>())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single instance must be registered first: a second `typemd file.md`
    // forwards its file argument to the running window instead of opening anew.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = file_arg(&argv) {
                let _ = app.emit("open-file", path);
            }
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![initial_file])
        .run(tauri::generate_context!())
        .expect("error while running TypeMD");
}
