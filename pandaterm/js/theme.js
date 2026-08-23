// js/theme.js
// Light/dark theme toggle. Pure DOM + localStorage, no other module
// dependency besides the shared state object.

/**
 * Applies the selected theme (light or dark) to the body.
 * @param {string} theme - The theme to apply ('light' or 'dark').
 */
function applyTheme(theme) {
  document.body.className = theme === 'dark' ? 'dark-mode' : '';
  state.currentTheme = theme;
  localStorage.setItem('theme', theme);
}

/**
 * Toggles between light and dark themes.
 */
function toggleTheme() {
  applyTheme(state.currentTheme === 'light' ? 'dark' : 'light');
}
