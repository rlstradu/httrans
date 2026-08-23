=========================================
Pandoria v1.3.0 - Dark Mode
=========================================
Release Date: August 23, 2026

Adds a dark theme, matching the one already available in PandaTerm.

Key Features

**Dark Mode**
* A new "Cambiar tema" / "Toggle theme" button in the main controls row
  switches between light and dark themes. The choice is remembered
  between sessions (saved to your browser's local storage), the same way
  PandaTerm's theme toggle works.
* Every screen was checked in dark mode: the language setup screen, the
  translation-memory table (including inline editing), the alignment
  tool and its mismatched-line wizard, and every modal (delete
  confirmation, import code, restore session, changelog).

=========================================
Pandoria v1.2.0 - Modular Codebase & TMX Compatibility
=========================================
Release Date: August 23, 2026

This release is a behind-the-scenes overhaul focused on compatibility and
maintainability rather than new features. The codebase has been split into
a proper project structure, the Tailwind CSS dependency is now a local
build instead of a live CDN script, and the TMX export has been fixed and
verified against the official TMX standard so memories created in
Pandoria import cleanly into Subversia and third-party CAT tools. A
version button (top-right) was also added, showing this changelog. The
app's design and day-to-day workflow are otherwise unchanged.

Key Features

**Modular Codebase**
* Refactored from a single HTML file into a clean project structure
  (`index.html`, `css/styles.css`, and a dozen focused files under `js/`),
  making the app far easier to maintain and extend going forward.
* No visual or behavioral changes beyond the fixes listed below.

**Offline-Capable Styling**
* Tailwind CSS is now compiled once into `css/styles.css` instead of being
  loaded live from a CDN `<script>` on every page open. Pandoria now looks
  and works identically with zero network access, instead of the entire
  layout depending on reaching cdn.tailwindcss.com.

**TMX Compatibility Fixes**
* Added the three TMX-header attributes the official TMX 1.4 DTD requires
  but the old export was missing (`creationtoolversion`, `segtype`,
  `o-tmf`). Verified with real DTD validation (`xmllint --valid`), not
  just visual inspection — the old header failed validation, the new one
  passes cleanly.
* Fixed case-sensitive language-code matching on import: a TMX file whose
  `<tuv xml:lang="...">` casing didn't match the header's `srclang`
  byte-for-byte used to have its entries silently dropped. Matching is now
  case-insensitive, with a positional fallback (matching how Subversia's
  own TMX importer behaves) for the rare file where codes don't match at
  all.
* Fixed a data-integrity bug where two translation-memory rows with
  identical source and target text could not be edited or deleted
  independently — the app would sometimes act on the wrong one of the
  pair. Every entry now has a stable internal id, used for every
  edit/delete lookup instead of matching by content.

**UI Change**
* Deleting a single row now asks for confirmation first, instead of
  deleting immediately (still recoverable via Undo either way).

**Version Button**
* A small `v1.2.0` button next to the language switcher opens a "What's
  new" modal showing this changelog, fetched live so it can be kept up to
  date independently of new Pandoria releases.

Known limitation carried over from this release: TMX inline formatting
tags (`<bpt>`, `<ept>`, `<ph>`, `<it>`, `<hi>`, `<ut>`) inside a `<seg>`
are not preserved on import — Pandoria is a plain-text TM editor, so
these are flattened to plain text rather than round-tripped.
