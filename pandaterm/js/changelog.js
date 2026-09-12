// js/changelog.js
// The version button (top-right, next to the language switcher) and its
// "What's new" modal.
//
// The version NUMBER below is a plain constant — bump it by hand on every
// release. The changelog TEXT itself is intentionally NOT bundled with the
// app: the modal fetches it live from CHANGELOG_URL every time it's
// opened, so publishing an updated pandaterm.md at that address is enough
// to update what users see here — no code change or new PandaTerm release
// needed for that part.
//
// The address is relative on purpose. It used to be written out in full,
// pointing at httrans.org: with the domain baked into the code, these links
// break the day the hosting or the GitHub username changes, and reading a file
// from the site itself needed a permissive CORS header to work at all. A
// relative path needs neither. If the request still fails (offline, 404), the
// modal shows a short error plus the "open in a new tab" link.

const PANDATERM_VERSION = '1.2.0';
const CHANGELOG_URL = '../changelog/pandaterm.md';

/**
 * Sets the version button's label. Called once on startup from main.js.
 */
function initVersionButton() {
  const btn = document.getElementById('versionBtn');
  if (btn) btn.textContent = 'v' + PANDATERM_VERSION;
}

/**
 * Opens the "What's new" modal and kicks off the changelog fetch.
 */
function showChangelogModal() {
  const existing = document.getElementById('changelogModal');
  if (existing) existing.remove();

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.id = 'changelogModal';

  const t = translations[state.currentUILanguage];

  modalOverlay.innerHTML = `
        <div class="modal-content large-modal">
            <button class="close-modal-btn" onclick="closeModal('changelogModal')">&times;</button>
            <h3>${t['changelog_title']} — v${PANDATERM_VERSION}</h3>
            <div class="input-group">
                <textarea id="changelogText" class="code-editor" readonly>${t['changelog_loading']}</textarea>
                <div class="changelog-link">
                    <a href="${CHANGELOG_URL}" target="_blank" rel="noopener noreferrer">${t['changelog_open_link']}</a>
                </div>
            </div>
            <div class="dialog-buttons">
                <button class="btn-secondary" onclick="closeModal('changelogModal')">${t['close_button']}</button>
            </div>
        </div>
    `;
  document.body.appendChild(modalOverlay);

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
      const textarea = document.getElementById('changelogText');
      if (textarea) textarea.value = text;
    })
    .catch((err) => {
      console.warn('No se pudo cargar el changelog:', err);
      const textarea = document.getElementById('changelogText');
      if (textarea) {
        textarea.value = translations[state.currentUILanguage]['changelog_error'];
      }
    });
}
