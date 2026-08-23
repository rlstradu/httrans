# PandaTerm

A simple TBX/CSV glossary editor. Fully client-side, no backend, no
build step: plain classic scripts, loaded directly by the browser.

## Running it locally

Just open `index.html`, the same as before the refactor (double-click
it, or drag it into a browser tab). No server needed.

An earlier draft of this refactor used ES modules (`<script
type="module">` with `import`/`export`), which is cleaner in principle,
but browsers block ES module imports over the `file://` protocol, so
double-clicking `index.html` produced a completely dead page (every
button silently did nothing). That's why the `js/` files here are plain
classic scripts instead: `index.html` loads them in dependency order via
a list of `<script src="...">` tags, and they share one global scope,
the same way the original single inline `<script>` block did. If you
add a new `js/` file, add its `<script>` tag in `index.html` in the
right spot for what it depends on (see the comment above that list),
and keep `js/main.js` last.

Deploying is the same as before: upload the whole folder (`index.html`,
`css/`, `js/`) to any static host, flat structure preserved.

## File layout

| File | Purpose |
| --- | --- |
| `index.html` | Markup only. No inline CSS or JS. |
| `css/styles.css` | All styling, extracted verbatim from the old inline `<style>` block. No visual changes. |
| `js/translations.js` | The EN/ES copy dictionary and the ISO language list. Pure data. |
| `js/state.js` | The one shared mutable state object (glossary, history, current language/theme, etc.) every other module reads and writes through. |
| `js/theme.js` | Light/dark theme toggle. |
| `js/i18n.js` | Applies the UI language to every `[data-i18n]` element. |
| `js/dialogs.js` | Generic message box, confirm dialog, toast, modal close. |
| `js/backup.js` | Autosave/restore of the glossary to `localStorage`. |
| `js/glossaryTable.js` | Core CRUD: add/edit/delete a term, render the table, undo history, section/collapse toggling. |
| `js/tbx.js` | TBX import/export (see Compatibility notes below). |
| `js/csv.js` | CSV import/export. |
| `js/exportDialog.js` | The "Export" button's format-choice modal. |
| `js/changelog.js` | The version button (top-right, next to the language switcher) and its "What's new" modal, which fetches the changelog text live (see below). |
| `js/main.js` | Wires everything together: `DOMContentLoaded` init and event listeners. Must load last. |

No design or behavior changes were made in this refactor beyond the TBX
fixes below; every file/section split follows the original single file's
own section comments.

## Compatibility notes (TBX)

`js/tbx.js` was updated so a glossary exported from PandaTerm reliably
imports into both Subversia and Locversia:

- **Element casing.** PandaTerm used to export `<LangSet>` (capital L).
  The TBX standard, and Subversia's own importer (verified directly
  against `SubVersia/src/core/parsers/tbx.js`), use lowercase `langSet`.
  XML tag matching is case-sensitive, so a TBX file exported by the old
  PandaTerm imported as **silently empty** in Subversia (0 langSets
  found, no error shown). Fixed by exporting `langSet` lowercase. The
  importer now accepts either casing on read, so glossaries already
  exported by the old PandaTerm still import back into PandaTerm fine.
- **XML escaping.** Term/definition/notes text used to be written into
  the exported XML with no escaping. A term containing `&`, `<`, `>`, or
  a quote produced malformed XML that failed to parse anywhere,
  including PandaTerm's own re-import. Fixed with a proper `escapeXml()`
  pass on every field.
- **`martifHeader`.** Added the header block the TBX/DTD structure
  expects (`fileDesc`/`sourceDesc`), matching Subversia's own exporter
  and improving compliance with tools that validate against it.
- **Element order inside `<tig>`.** `TBXcoreStructV02.dtd` declares
  `tig` as `(term, (termNote)*, %auxInfo;)` — every `termNote` must come
  before any `descrip` (part of the `auxInfo` group), not after. The
  export used to write `descrip` (definition) before `termNote` (notes),
  which is invalid against that ordering. Fixed by swapping the order.
  Confirmed with `xmllint --valid` against the real DTD: the old order
  fails validation, the new one passes cleanly.

Locversia has no single dedicated TBX parser file the way Subversia
does (`src/core/parsers/tbx.js`), so its exact parsing conventions
weren't directly verifiable this round; targeting the same
Subversia-verified, standard TBX shape is the safest common baseline.
Worth a real Locversia import test as a follow-up.

Note this does **not** cover CSV: PandaTerm's CSV export (semicolon
delimited, 7 columns) doesn't match Subversia's own CSV glossary
importer (comma delimited, term in column 1). That's a separate gap,
out of scope for this pass since the request was specifically about
TBX.

## Version button / changelog modal

Top-right, next to the language switcher, there's a small `vX.Y.Z` button
(`js/changelog.js`). Clicking it opens a modal with a read-only text box
showing the changelog, fetched **live** from:

    https://httrans.org/changelog/pandaterm.txt

Nothing about the changelog's text is bundled into the app — publishing an
updated `pandaterm.txt` at that address is enough to change what the modal
shows, no PandaTerm code change or release needed. The version *number* on
the button itself (`PANDATERM_VERSION` in `js/changelog.js`) is a plain
constant and still needs to be bumped by hand on each release.

One thing to know: when PandaTerm is opened via `file://` (double-click),
the browser sends the fetch request with `Origin: null`. That only
succeeds in loading the text if the server hosting the changelog file
answers with a permissive CORS header (`Access-Control-Allow-Origin: *`,
or one that explicitly allows `null`) for that URL — most static hosts
don't set this by default. I wasn't able to check this from here (outbound
requests to httrans.org were blocked from this sandbox — looked like a WAF
rejecting the request, not a PandaTerm bug), so please open the modal once
after publishing to confirm it loads. If it doesn't, the fix is on the
server side (enable CORS for that file, or that whole path), not in
PandaTerm — the modal falls back to a short error message plus a direct
"open in a new tab" link either way, so it degrades gracefully instead of
looking broken.

## Compatibility notes (third-party CAT tools: Trados, memoQ)

Checked against RWS/memoQ's own documentation (see chat for sources).
Short version: PandaTerm's TBX now validates cleanly against the real
TBX DTD (`xmllint --valid`), which is necessary for third-party
compatibility but the two tools differ a lot in how "compatible" even
looks:

- **Trados Studio / MultiTerm** does not import a raw TBX (or CSV) file
  directly into a termbase at all, regardless of how well-formed it is.
  Everything goes through the separate **MultiTerm Convert** utility
  first, which converts the source file to `*.mtf.xml` plus an `*.xdt`
  termbase definition via a field-mapping wizard, and only that
  converted file gets imported. TBX is one of Convert's accepted source
  formats, so a valid PandaTerm TBX export should feed into that wizard
  fine, but the extra conversion step is unavoidable no matter what
  PandaTerm does. Real-world reports (RWS community, ProZ forum) also
  show MultiTerm Convert can reject or silently drop entries from
  TBX files that are well-formed XML but structurally invalid against
  the DTD (e.g. terms in attributes instead of elements) — exactly the
  class of bug this pass fixed.
- **memoQ** imports TBX directly into a term base (no external
  conversion tool), so a valid PandaTerm TBX export should just work.
  memoQ's own docs note that only the actual terms and translations are
  guaranteed to carry over; some metadata can be lost depending on the
  TBX dialect. memoQ's desktop term base import also accepts CSV/
  tab-separated and Excel files directly, through a wizard where you
  manually map each column and choose the delimiter — so PandaTerm's
  semicolon-delimited CSV should import into memoQ fine (unlike
  Subversia's importer, memoQ doesn't require specific header names
  since you map columns by hand).
