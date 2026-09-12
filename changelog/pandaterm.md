# PandaTerm

## v1.2.0 — Modular Codebase & CAT Tool Compatibility

*August 23, 2026*

This release is a behind-the-scenes overhaul focused on compatibility and
maintainability rather than new features. The codebase has been split into a
proper project structure, and the TBX export has been fixed and verified against
the official TBX standard so glossaries created in PandaTerm import cleanly into
Subversia, Locversia, and third-party CAT tools. The app's design and day-to-day
workflow are unchanged.

### Key Features

### Modular Codebase

- Refactored from a single HTML file into a clean project structure (index.html,
  css/styles.css, and a dozen focused files under js/), making the app far easier
  to maintain and extend going forward.

- **No visual or behavioral changes beyond the fixes listed below:** PandaTerm looks
  and works exactly as before, and still runs by simply double-clicking index.html
  — no server or build step required.

### TBX Compatibility Fixes

- Fixed element casing (langSet vs LangSet) that could cause a glossary exported
  from PandaTerm to import as completely empty in Subversia.

- Added proper XML escaping for terms, definitions, and notes containing
  characters like &, <, >, or quotes, which previously produced malformed files
  that failed to parse anywhere, including on re-import into PandaTerm itself.

- Added the martifHeader block required by the TBX file structure.

- Fixed the ordering of termNote and descrip elements inside each tig to match
  the official TBXcoreStructV02.dtd. Verified with real DTD validation (xmllint
  --valid), not just visual inspection.

- Verified Third-Party CAT Tool Compatibility

- PandaTerm's TBX export now validates cleanly against the official TBX DTD.

- Confirmed compatible with memoQ, which imports TBX, CSV, and Excel glossaries
  directly with no conversion step.

- Documented that Trados/MultiTerm requires every glossary import (TBX or CSV)
  to go through the separate MultiTerm Convert utility first — this is a Trados
  requirement, not a PandaTerm limitation, but it's worth knowing before
  importing.

### UI Fix

- Fixed a visual glitch where the delete-confirmation modal would briefly flash
  off-center before jumping to the middle of the screen.

- Known limitation carried over from this release: PandaTerm's CSV export
  (semicolon-delimited, 7 columns) still doesn't match Subversia's own CSV
  importer (comma-delimited, term expected in the first column). CSV export works
  well for memoQ, which lets you map columns by hand. A dedicated fix for
  Subversia's CSV importer is tracked as a follow-up.

## v1.1.1 — Direct Code Import

*November 25, 2025*

This update focuses on workflow efficiency by allowing users to import glossary
data directly from the clipboard, eliminating the need to save and upload
temporary text files. The import process is now faster and includes intelligent
validation to ensure data integrity.

### Key Features

- **Quick Import & Validation**

- **Import from Code**: A new "Import Code" button has been added to the control
  panel. You can now paste XML or TBX content directly into a dedicated editor
  window—perfect for quick transfers when you already have the raw code in your
  clipboard.

- **Real-time Syntax Checking**: The new import modal features a live validator
  that checks your XML syntax as you paste. It instantly provides visual
  feedback—a green checkmark for valid structures or a red warning for
  errors—preventing invalid imports before they happen.

- **Smart Language Detection**: The direct code importer utilizes the same
  intelligent parsing engine as the file importer, automatically detecting source
  and target languages (e.g., en-US/es-ES) from the pasted content without manual
  configuration.

## v1.1.0 — CSV Support & Session Restore

*November 7, 2025*

This is a major feature update that introduces full support for the CSV format
(import and export) and adds a critical session restore feature to prevent data
loss. The user interface has also been streamlined for a cleaner, more efficient
workflow.

### Key Features

- **CSV & TBX Management**

- **CSV Import:** You can now import glossaries from .csv files. The importer
  intelligently finds your terms by looking for headers like "Source Term" and
  "Target Term" or the glossary's language codes (e.g., "en-US", "es-ES").

- **CSV & TBX Export:** Glossaries can now be exported to .csv format (in addition
  to TBX) via a new export dialog. The CSV is saved with UTF-8 BOM to ensure
  compatibility with accents and special characters in Excel.

- **Unified Interface:** The main buttons have been renamed from "Import TBX" /
  "Download TBX" to the more general "Import" and "Export" to reflect multi-format
  support. The app description is updated to "A simple TBX/CSV glossary editor".

- **Session Backup & Restore Automatic Session Saving:** Your work is now
  automatically saved to your browser's local storage every time you add, edit,
  delete, or import a term.

- **Restore on Launch:** Never lose your work again! If you accidentally close the
  tab or refresh the page, PandaTerm will find your previous session on startup
  and ask if you want to restore or discard it.

- **Productivity & User Experience Collapsible Sections:** The "Current glossary
  languages" and "Add term" sections are now collapsible, allowing you to hide
  them for a cleaner view of your glossary table.

- **Toast Notifications:** Informational messages (like "Import successful") now
  appear as non-intrusive "toast" notifications at the bottom of the screen,
  replacing the previous modal pop-ups for non-critical alerts.

## v1.0.0 — Launch Announcement

*July 28, 2025*

Welcome to the first official release of PandaTerm!

PandaTerm is a free, offline-first, browser-based tool designed for creating,
editing, and managing terminologies in the standard TBX format. It runs entirely
in your browser, ensuring your data always stays private and under your control.
This release provides a comprehensive set of features for robust glossary
management.

### Key Features

### Core Glossary Management

- **Create Glossaries from Scratch**: Start a new glossary by defining the source
  and target languages for your project.

- **Import TBX Files**: Load existing glossaries in the standard TBX format.
  PandaTerm is built to be compatible with different TBX dialects (handling both
  `<martif>` and `<tbx>` root elements) and will auto-detect the primary languages
  from the file.

- **Export to TBX**: Download your complete glossary as a clean,
  standards-compliant TBX file, ready for use in professional CAT tools.

### Detailed Term Editing

- **Rich Term Data**: Each glossary entry can include a source term, target term,
  definition, notes, and part of speech (e.g., noun, verb, adjective).

- **User-Friendly Editing**: Click on any term in the table to open a clear and
  simple modal window for editing all its details.

- **Clickable Links**: Any URLs included in the "Definition" or "Notes" fields are
  automatically converted into clickable links for easy access.

### Productivity & User Experience

- **Powerful Search**: Instantly filter your glossary as you type. You can scope
  your search to source terms only, target terms only, or all fields.

- **Undo Functionality**: Made a mistake? Easily undo your last action (add, edit,
  or delete) with the "Undo" button or the standard Ctrl+Z keyboard shortcut.

- **Light & Dark Themes**: Switch between a light and dark theme for your visual
  comfort with a single click.

- **Keyboard Navigation**: Speed up new term creation by using the Enter key to
  navigate through the input fields.

- **Multilingual Interface**: The PandaTerm user interface is available in both
  English and Spanish.

### Getting Started

1. Open the `pandaterm.html` file in your preferred web browser.

2. Configure your source and target languages or import an existing TBX file.

3. Begin building your glossary!

### Feedback & Contributions

As this is the first version, your feedback is incredibly valuable. If you
encounter any issues, have ideas for new features, or would like to contribute,
please don't hesitate to reach out.

Thank you for using PandaTerm!
