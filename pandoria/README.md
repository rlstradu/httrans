# Pandoria

A simple TMX translation-memory editor and text-alignment tool. Fully
client-side, no backend, no build step to run it.

## Running it locally

Just open `index.html` (double-click it, or drag it into a browser tab).
No server needed.

Deploying is the same: upload the whole folder (`index.html`, `css/`,
`js/`) to any static host, flat structure preserved.

## File layout

| File | Purpose |
| --- | --- |
| `index.html` | Markup only. No inline CSS or JS. |
| `css/styles.css` | All styling: a Tailwind CSS build (see below) plus Pandoria's own hand-written CSS, extracted verbatim from the old inline `<style>` block. No visual changes. |
| `js/translations.js` | The EN/ES copy dictionary and the ISO language list. Pure data. |
| `js/state.js` | The shared mutable state (`translationMemory`, `tmSourceLanguage`, `tmTargetLanguage`, `currentLanguage`, `historyStack`) every other file reads and writes through. |
| `js/dom.js` | Every cached DOM element reference, in one place. |
| `js/utils.js` | `escapeHTML`, `escapeXML`, `generateEntryId` (see the TMX compatibility notes below). |
| `js/dialogs.js` | The generic message box and confirm/cancel modal helpers. |
| `js/backup.js` | Autosave/restore of the editor or alignment view to `localStorage`. |
| `js/i18n.js` | UI language switching and the ISO language datalist. |
| `js/theme.js` | Light/dark theme toggle (see Dark mode below). |
| `js/tmTable.js` | Core CRUD: add/edit/delete an entry, render the table, undo history, keyboard navigation between cells. |
| `js/editor.js` | Creating/resetting a TM and confirming its languages. |
| `js/tmx.js` | TMX parsing, generation/download, file import, and the "paste code" import modal (see Compatibility notes below). |
| `js/alignment.js` | The text-alignment feature: file/paste input, alignment, and the mismatched-line wizard. |
| `js/changelog.js` | The version button (top-right, next to the language switcher) and its "What's new" modal. |
| `js/main.js` | Wires everything together: `DOMContentLoaded` init and event listeners. Must load last. |

No design or behavior changes were made in this refactor beyond the fixes
documented below; every file split follows the original single file's own
section comments.

### Why classic scripts, not ES modules

Same reasoning as Pandoria's sister tool, PandaTerm: browsers block ES
module imports (`<script type="module">`) over the `file://` protocol, so
double-clicking `index.html` would produce a completely dead page if these
were real `import`/`export` modules. Every `js/` file here is a plain
classic `<script src="...">`, loaded in dependency order, sharing one
global scope — a `function foo() {}` or top-level `let`/`const` in one
file is reachable by every file loaded after it. `js/main.js` must stay
last, and the whole `<script>` block must stay at the end of `<body>`
(several files, like `js/dom.js`, cache element references the moment
they're parsed, so the markup above them must already exist).

### Why Tailwind is a local build now, not a CDN `<script>`

The original file loaded Tailwind from the Play CDN
(`<script src="https://cdn.tailwindcss.com">`), which compiles utility
CSS live, in the browser, every time the page loads. That means the app
needed internet access just to look right — offline, on a restrictive
network, or with a script blocker, the layout would collapse almost
entirely, since nearly every element is styled with Tailwind classes.

`css/styles.css` now starts with a Tailwind CSS v3 build compiled
**offline**, once, with the Tailwind CLI run directly against this
project's own `index.html` (`tailwindcss@3`, matching the engine version
the Play CDN itself has always used) — so it contains exactly the
Preflight reset plus the utility classes this markup actually uses, no
more and no less. Visually this is meant to be pixel-identical to what
the CDN produced, since it's the same compiler reading the same markup;
the app now looks and works with zero network access.

If you add **new** Tailwind classes to `index.html` later, you need to
regenerate that block or they simply won't do anything (nothing in the
checked-in CSS matches them yet):

```bash
npm install tailwindcss@3
npx tailwindcss -i input.css -o new-output.css --content index.html
# input.css just needs: @tailwind base; @tailwind components; @tailwind utilities;
```

Then splice the new output into the top of `css/styles.css`, above the
"Pandoria's own CSS" section (which is unrelated hand-written CSS and
should stay as-is).

Google Fonts (`Inter`) is still loaded from `fonts.googleapis.com`, same
as before — that one's a soft dependency (the page falls back to a system
font if it can't reach it), not a hard breakage, so it was left alone.

## Compatibility notes (TMX)

`js/tmx.js` was updated so a memory exported from Pandoria reliably
imports into Subversia and into third-party CAT tools, and so Pandoria
itself is more robust when importing TMX files from elsewhere:

- **Incomplete TMX header.** The TMX 1.4 DTD marks seven `<header>`
  attributes `#REQUIRED`: `creationtool`, `creationtoolversion`,
  `segtype`, `o-tmf`, `adminlang`, `srclang`, `datatype`. The old export
  only wrote four of them (missing `creationtoolversion`, `segtype`,
  `o-tmf`). Confirmed with `xmllint --valid` against the real, official
  `tmx14.dtd`: the old header failed validation ("Element header does not
  carry attribute o-tmf/segtype/creationtoolversion"); the new one, which
  includes all seven, passes cleanly. This didn't affect importing into
  Subversia (its TMX parser doesn't read the header beyond `srclang`), but
  it matters for any stricter TMX consumer that validates the header.
- **Case-sensitive language-code matching.** TMX language codes are
  BCP-47 tags (like `en-US`) that are meant to be compared
  case-insensitively, but the import logic used a strict `===` between
  each `<tuv xml:lang="...">` and the `<header srclang="...">`. A file
  where the casing didn't match byte-for-byte — e.g. header says
  `EN-US` but a `tuv` says `en-us` — had its entries silently dropped, no
  error, just fewer rows than expected. Verified this by importing a
  TMX file with inconsistent casing across its header and `tuv`
  elements: under the old logic every entry in that file was lost; with
  the fix (case-insensitive comparison, plus falling back to plain
  document order — first `tuv` = source, second = target — for any `tu`
  whose codes don't match the header at all) both entries import
  correctly. The positional fallback also matches how Subversia's own
  TMX importer behaves: it doesn't check language codes either, it just
  takes `tuv` #1 / `tuv` #2 in order.
- **Duplicate-row identity bug.** Table rows used to be matched back to
  the underlying data by re-finding them via
  `translationMemory.findIndex(e => e.srcText === ... && e.tgtText === ...)`
  — i.e. by content, not identity. Translation memories very often
  contain duplicate or near-duplicate segments, and with two identical
  rows on screen, editing or deleting one could silently act on the
  *other* one instead. Every entry now gets a stable internal `id`
  (`generateEntryId()` in `js/utils.js`) the moment it's created —
  by hand, from a TMX import, or from the alignment tool — and all
  edit/delete lookups use that id instead of content matching. Verified
  with two byte-for-byte identical rows: editing/deleting one now always
  affects the intended row, never its duplicate. As a small side benefit,
  each entry's id is now also written out as the `tuid` attribute on its
  `<tu>` when exporting, which nothing required but helps round-tripping
  and matches Subversia's own TMX export convention.

Two things worth knowing that were **not** changed:

- **Inline formatting tags are not preserved.** TMX's `<seg>` element can
  contain `<bpt>`/`<ept>`/`<ph>`/`<it>`/`<hi>`/`<ut>` inline tags (common
  in files exported by Trados/memoQ for embedded formatting, tags, or
  placeholders). Pandoria parses each `<seg>` with the browser's
  `DOMParser` and reads `.textContent`, which silently flattens any such
  inline tags to plain text — the words survive, the formatting markup
  doesn't. Pandoria is a plain-text TM editor, so properly round-tripping
  inline tags would be a much bigger change; flagging it here as a known
  limitation rather than something this pass addressed.
- **No `<!DOCTYPE tmx SYSTEM "tmx14.dtd">` declaration** is written into
  exported files, matching Subversia's own TMX export (which also omits
  it). This is intentional, not an oversight: most real-world TMX
  consumers don't fetch the external DTD to validate against it, and
  adding a DOCTYPE that points at a file that isn't actually shipped
  alongside the export could make an unusually strict parser worse off,
  not better.

## Compatibility notes (third-party CAT tools: Trados, memoQ)

- **memoQ** imports TMX files directly, with no external conversion tool
  — through its "Import with Options" / TMX filter in the translation
  memory import settings. One memoQ-specific caveat from its own docs: if
  a TMX file mixes different sublanguages of the same base language (say,
  US and UK English), memoQ can't automatically tell which one you mean
  without you picking it manually during import; that's a memoQ project-
  setup detail, not something the exported file can avoid.
- **Trados Studio** accepts TMX (`*.tmx`, `*.tmx.gz`) as an import format
  for a translation memory. Unlike MultiTerm's termbase imports (see
  PandaTerm's own README for that comparison), Studio's TM import doesn't
  require a separate conversion utility. For server-based TMs specifically,
  RWS's own docs note the import runs in the background and newly
  imported units may take up to 60 minutes to be reflected in the TU
  count — worth knowing so a "0 new entries" reading right after import
  isn't mistaken for a failure.
- Documentation for both tools is largely process-focused (how to click
  through the import wizard) rather than a technical spec of exactly how
  strict their TMX parsing is — the concrete, verifiable fix from this
  pass is that Pandoria's TMX now validates cleanly against the official
  DTD, which is the baseline any of these tools' importers would expect.

## Version button / changelog modal

Top-right, next to the language switcher, there's a small `vX.Y.Z` button
(`js/changelog.js`). Clicking it opens a modal with a read-only text box
showing the changelog, fetched **live** from:

    https://httrans.org/changelog/pandoria.txt

Nothing about the changelog's text is bundled into the app — publishing an
updated `pandoria.txt` at that address is enough to change what the modal
shows, no Pandoria code change or release needed. The version *number* on
the button (`PANDORIA_VERSION` in `js/changelog.js`) is a plain constant
and still needs to be bumped by hand on each release; it's also written
into every exported TMX's `creationtoolversion` header attribute, so
bumping it in one place keeps both in sync.

Same caveat as PandaTerm: opening Pandoria via `file://` sends the fetch
with `Origin: null`, which only succeeds if the server hosting the
changelog answers with a permissive CORS header
(`Access-Control-Allow-Origin: *`, or one that allows `null`) for that
URL. I wasn't able to check this from my end (outbound requests to
httrans.org were blocked from my sandbox — looked like a WAF rejecting
the request, not a Pandoria bug), so please open the modal once after
publishing to confirm it loads. If it doesn't, the fix is server-side
(enable CORS for that file), not in Pandoria — the modal falls back to a
short error message plus a direct "open in a new tab" link either way, so
it degrades gracefully instead of looking broken.

## Dark mode

A "Cambiar tema" / "Toggle theme" button sits in the main controls row,
next to "Alinear textos". Clicking it toggles a `dark-mode` class on
`<body>` and remembers the choice in `localStorage` — same mechanism
PandaTerm's `js/theme.js` uses.

The implementation differs from PandaTerm's in one way, because the two
apps' CSS is built differently. PandaTerm's colors are all CSS custom
properties (`--text-color`, `--card-background`, etc.) redefined once
under `body.dark-mode`, so every element updates automatically. Pandoria's
markup mixes Tailwind utility classes (`bg-white`, `text-gray-600`,
`border-gray-300`, ...) with a handful of hand-written classes
(`.container`, `.modal-content`, `.lang-btn`, `.wizard-*`) — introducing
CSS variables everywhere would have meant touching most of `index.html`.
Instead, `css/styles.css` ends with a block of `body.dark-mode <selector>`
overrides that target those SAME selectors directly (e.g.
`body.dark-mode .bg-white { background-color: #1f2937 !important; }`).
Since that block is the last thing in the file, it wins the cascade over
both the compiled Tailwind build and Pandoria's own CSS above it, with no
changes to `index.html`'s classes and no Tailwind rebuild needed. If you
add a new element with a Tailwind gray/blue/white color class that isn't
already covered there, add a matching `body.dark-mode .that-class { ... }`
line to the same block, or it'll stay light-colored in dark mode.

## Other small change made together with the above

At your request, deleting a single row now asks for confirmation first
(reusing the same generic confirm modal already used for "new TMX" and
"start alignment over"), instead of deleting immediately. It's still
recoverable either way via Undo (Ctrl+Z or the Undo button).
