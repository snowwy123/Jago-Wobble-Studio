# Working on Jago Wobble Studio

Edit the files here, then rebuild the app. The HTML files in the main folder are built copies.

## Browser build

From the main folder, with Node.js installed:

```text
node Source/build-browser.cjs
node --test Source/Tests/build.test.cjs
```

This creates identical copies of `Jago-Wobble-Studio.html` and `index.html`. There are no browser build dependencies to install.

## Windows build

Build the browser version first, then run in Windows PowerShell:

```text
.\Source\Windows\Build.ps1
```

The script uses the .NET Framework C# compiler and downloads the pinned WebView2 SDK if needed. To use an existing SDK folder, add `-SdkDirectory C:\path\to\WebView2SDK`.

The EXE embeds the browser app and its supporting files. WebView2 Runtime must be installed on the user's computer. Building does not code-sign the EXE.

## Finding your way around

- `Browser/shell.html`: interface and Help text.
- `Browser/*.css`: layout and colour themes.
- `Browser/project.js`, `files.js`: projects, saving and undo.
- `Browser/drawing.js`, `brushes.js`, `motion.js`: drawing and animation.
- `Browser/workflow.js`, `pointer.js`: selections and canvas gestures.
- `Browser/colour-picker.js`: the shared colour wheel.
- `Browser/gif.js`, `png-sequence.js`, `export.js`: exports.
- `Windows`: the desktop wrapper and its build script.
- `Brand/logo.svg`: the header logo and browser icon.

`browser-files.json` sets the script order. The scripts share state, so keep that order when rebuilding. Existing storage keys and project fields are kept for compatibility with saved drawings.

## Checks

The Windows app includes an isolated self-test:

```text
.\Jago-Wobble-Studio.exe --self-test C:\path\to\new-test-folder
```

Use a fresh folder and check `result.txt` for PASS. It tests drawing, presets, saving and exports without using your normal profile.

Keep [LICENSE](../LICENSE) and the Microsoft files in [Notices](../Notices) with redistributed Windows builds.
