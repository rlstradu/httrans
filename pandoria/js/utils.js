// js/utils.js
// Small stateless helpers used across the app. No dependencies.

/**
 * Escapes a plain string for safe insertion as HTML text content.
 * @param {string} str
 * @returns {string}
 */
const escapeHTML = (str) => {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
};

/**
 * Escapes a plain string for safe insertion into XML text/attribute
 * content (used when generating TMX).
 * @param {string} str
 * @returns {string}
 */
const escapeXML = (str) => str.replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;'
}[c]));

/**
 * Generates a short, unique-enough id for a translation-memory entry.
 * Every entry (added by hand, imported from a TMX file, or produced by
 * the alignment tool) gets one of these as soon as it's created, and it
 * never changes for the entry's lifetime — including through undo/redo,
 * since saveStateToHistory() deep-clones entries (id included).
 *
 * Rows used to be identified by re-finding them in `translationMemory`
 * via `indexOf`/`findIndex` on their *content* (matching srcText AND
 * tgtText). That broke for duplicate entries: editing or deleting one
 * row of a duplicate pair could silently act on the OTHER one instead,
 * because content-matching can't tell two identical rows apart. Using a
 * stable id set once at creation time removes the ambiguity entirely.
 * @returns {string}
 */
function generateEntryId() {
    return 'tu-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
