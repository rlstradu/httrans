# Pandoria

## v1.3.0 — Dark Mode

*August 23, 2026*

Adds a dark theme, matching the one already available in PandaTerm.

### Key Features

- **Dark Mode**

- A new "Cambiar tema" / "Toggle theme" button in the main controls row switches
  between light and dark themes. The choice is remembered between sessions (saved
  to your browser's local storage), the same way PandaTerm's theme toggle works.

- **Every screen was checked in dark mode**: the language setup screen, the
  translation-memory table (including inline editing), the alignment tool and its
  mismatched-line wizard, and every modal (delete confirmation, import code,
  restore session, changelog).

## v1.2.0 — Modular Codebase & TMX Compatibility

*August 23, 2026*

This release is a behind-the-scenes overhaul focused on compatibility and
maintainability rather than new features. The codebase has been split into a
proper project structure, the Tailwind CSS dependency is now a local build
instead of a live CDN script, and the TMX export has been fixed and verified
against the official TMX standard so memories created in Pandoria import cleanly
into Subversia and third-party CAT tools. A version button (top-right) was also
added, showing this changelog. The app's design and day-to-day workflow are
otherwise unchanged.

### Key Features

- **Modular Codebase**

- Refactored from a single HTML file into a clean project structure (`index.html`,
  `css/styles.css`, and a dozen focused files under `js/`), making the app far
  easier to maintain and extend going forward.

- No visual or behavioral changes beyond the fixes listed below.

- **Offline-Capable Styling**

- Tailwind CSS is now compiled once into `css/styles.css` instead of being loaded
  live from a CDN `<script>` on every page open. Pandoria now looks and works
  identically with zero network access, instead of the entire layout depending on
  reaching cdn.tailwindcss.com.

- **TMX Compatibility Fixes**

- Added the three TMX-header attributes the official TMX 1.4 DTD requires but the
  old export was missing (`creationtoolversion`, `segtype`, `o-tmf`). Verified
  with real DTD validation (`xmllint --valid`), not just visual inspection — the
  old header failed validation, the new one passes cleanly.

- Fixed case-sensitive language-code matching on import: a TMX file whose `<tuv
  xml:lang="...">` casing didn't match the header's `srclang` byte-for-byte used
  to have its entries silently dropped. Matching is now case-insensitive, with a
  positional fallback (matching how Subversia's own TMX importer behaves) for the
  rare file where codes don't match at all.

- Fixed a data-integrity bug where two translation-memory rows with identical
  source and target text could not be edited or deleted independently — the app
  would sometimes act on the wrong one of the pair. Every entry now has a stable
  internal id, used for every edit/delete lookup instead of matching by content.

- **UI Change**

- Deleting a single row now asks for confirmation first, instead of deleting
  immediately (still recoverable via Undo either way).

- **Version Button**

- A small `v1.2.0` button next to the language switcher opens a "What's new" modal
  showing this changelog, fetched live so it can be kept up to date independently
  of new Pandoria releases.

- Known limitation carried over from this release: TMX inline formatting tags
  (`<bpt>`, `<ept>`, `<ph>`, `<it>`, `<hi>`, `<ut>`) inside a `<seg>` are not
  preserved on import — Pandoria is a plain-text TM editor, so these are flattened
  to plain text rather than round-tripped.

## v1.1.1 — Code Import & Shortcuts

*November 25, 2025*

This update focuses on workflow flexibility and speed, adding direct code
handling and improved editor navigation.

### New Features

- **Direct TMX Code Import**: You can now import a TMX translation memory by
  simply pasting the raw XML code, removing the need to upload a physical file.
  The new "Import Code" modal includes real-time validation, displaying a green
  indicator for valid code or a red warning for errors before importing.

- **Keyboard Navigation Shortcuts**: To speed up the editing process, you can now
  navigate between segments using your keyboard. Use Ctrl + Down Arrow to jump to
  the next segment and Ctrl + Up Arrow to return to the previous one.

## v1.1.0 — Auto-Backup

*November 7, 2025*

This update introduces a crucial quality-of-life feature: automatic session
backup.

### New Features

- **Automatic Backup & Restore**: Pandoria now automatically saves your progress
  (in both the TMX editor and the alignment tool) to your browser's local storage.
  If you accidentally close the tab or browser, a prompt will appear the next time
  you open the application, asking if you want to restore the previous session.
  The backup is automatically cleared when you create a "New TMX" or "Download
  TMX," ensuring a clean start.

## v1.0.0 — Launch Announcement

*July 28, 2025*

Pandoria is a free, browser-based tool with two primary functions: a
straightforward TMX editor and a powerful text alignment tool for creating new
translation memories from existing documents. It runs entirely offline in your
browser, ensuring your data remains secure on your computer.

### Key Features

### TMX Editor Features

- **Create, Import & Download TMX**: You can create a new Translation Memory (TMX)
  from scratch by defining language pairs, or import an existing TMX file to
  continue your work. When you're done, export your work as a standard TMX 1.4
  file.

- **Direct Inline Editing**: Edit source and target segments directly within the
  main table for a fast and seamless workflow.

- **Add & Delete Entries**: Easily add new translation units to your TM or delete
  unwanted ones with a single click.

- **Live Search**: Quickly filter your entire translation memory by searching for
  terms in both the source and target languages simultaneously.

- **Undo Support**: Reverse any recent changes (additions, edits, or deletions)
  with the dedicated Undo button or the universal Ctrl+Z shortcut.

### Text Alignment Tool

- **Create TMs from Existing Texts**: Align a source document with its translation
  to create a brand new TMX file from scratch.

- **Multiple Input Formats**: You can upload plain text (`.txt`) or subtitle files
  (`.srt`). The tool automatically parses the text content from SRT files. You can
  also paste your texts directly into the provided areas.

- **Alignment Wizard**: If your source and target texts have a different number of
  lines, Pandoria launches a powerful wizard. This side-by-side view allows you to
  manually edit, merge, or add lines to ensure the segments are perfectly matched
  before the TM is created.

- **Multilingual UI**: The Pandoria interface is available in both English and
  Spanish.

### Getting Started

1. Open the `pandoria.html` file in your web browser.

2. To edit an existing TM, click "Import TMX".

3. To create a new TM from scratch, click "Create new TMX".

4. To align documents, click "Align Texts".

### Feedback & Contributions

This is the very first version, and we welcome your feedback. If you find any
bugs, have feature suggestions, or want to contribute, please feel free to reach
out.

Thank you for using Pandoria!
