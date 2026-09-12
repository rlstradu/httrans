// js/changelog.js
// The version button (top-right, next to the language switcher) and its
// "What's new" modal (the static #changelogModal markup in index.html).
//
// The version NUMBER below is a plain constant — bump it by hand on every
// release (it's also used as the `creationtoolversion` attribute Pandoria
// writes into every exported TMX header, see js/tmx.js). The changelog
// TEXT itself is intentionally NOT bundled with the app: the modal fetches
// it live from CHANGELOG_URL every time it's opened, so publishing an
// updated pandoria.md at that address is enough to update what users see
// here — no code change or new Pandoria release needed for that part.
//
// The address is relative on purpose. It used to be written out in full,
// pointing at httrans.org: with the domain baked into the code, these links
// break the day the hosting or the GitHub username changes, and reading a file
// from the site itself needed a permissive CORS header to work at all. A
// relative path needs neither. If the request still fails (offline, 404), the
// modal shows a short error plus the "open in a new tab" link.

const PANDORIA_VERSION = '1.3.0';
const CHANGELOG_URL = '../changelog/pandoria.md';

/**
 * Sets the version button's label and the changelog link's href. Called
 * once on startup from main.js.
 */
function initVersionButton() {
    if (versionBtn) versionBtn.textContent = 'v' + PANDORIA_VERSION;
    if (changelogLink) changelogLink.href = CHANGELOG_URL;
}

/**
 * Opens the "What's new" modal and kicks off the changelog fetch.
 */
function showChangelogModal() {
    const t = translations[currentLanguage];
    changelogText.value = t['changelog_loading'];
    changelogLink.textContent = t['changelog_open_link'];
    changelogModal.style.display = 'flex';
    fetchChangelogText();
}

/**
 * Fetches CHANGELOG_URL and fills the modal's textarea with the raw text,
 * or a short translated error message if the request fails (offline,
 * 404, blocked by CORS, etc.) — the "open in a new tab" link underneath
 * stays available either way as a fallback.
 */
function fetchChangelogText() {
    fetch(CHANGELOG_URL, { cache: 'no-store' })
        .then((response) => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.text();
        })
        .then((text) => {
            changelogText.value = text;
        })
        .catch((err) => {
            console.warn('No se pudo cargar el changelog:', err);
            changelogText.value = translations[currentLanguage]['changelog_error'];
        });
}
