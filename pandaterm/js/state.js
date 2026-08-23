// js/state.js
// Single shared mutable state object for the whole app. Every other file
// reads and writes through this object (mutating arrays in place, or
// reassigning a property) instead of holding its own copy of
// `let glossary = []`, etc. Must be the FIRST <script> loaded in
// index.html (after translations.js) — every other file just refers to
// the bare `state` identifier, relying on this file's top-level `const`
// being visible to every classic <script> tag loaded after it.

const state = {
  // The glossary itself.
  glossary: [],
  // Action history for undo functionality.
  history: [],
  // Current UI language, default to English.
  currentUILanguage: localStorage.getItem('language') || 'en',
  // Current theme, default to light.
  currentTheme: localStorage.getItem('theme') || 'light',
  // The glossary's own defined source and target languages.
  glossarySourceLanguage: '',
  glossaryTargetLanguage: '',
  // Column visibility state - always true, the toggle button was removed
  // upstream but the map is kept so applyColumnVisibility() stays a no-op
  // rather than special-cased.
  columnVisibility: {
    source_term_col: true,
    target_term_col: true,
    definition_col: true,
    notes_col: true,
    part_of_speech_col: true,
    actions_col: true
  }
};
