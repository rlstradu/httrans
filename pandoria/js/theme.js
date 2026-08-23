// js/theme.js
// Light/dark theme toggle, mirroring PandaTerm's own js/theme.js: a single
// `body.dark-mode` class flips every color rule in css/styles.css that has
// a `body.dark-mode ...` override, and the choice persists in localStorage.
//
// One difference from PandaTerm's version: PandaTerm's <body> carries no
// other classes, so it can just set `document.body.className = 'dark-mode'
// | ''` wholesale. Pandoria's <body> already carries Tailwind layout
// classes (`flex flex-col items-center min-h-screen p-4 sm:p-6 md:p-8`),
// so this uses classList.toggle() instead of replacing the whole
// className, to avoid wiping those out.

/**
 * Applies the selected theme (light or dark) to the body.
 * @param {string} theme - 'light' or 'dark'.
 */
function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    currentTheme = theme;
    localStorage.setItem('pandoriaTheme', theme);
}

/**
 * Toggles between light and dark themes.
 */
function toggleTheme() {
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
}
