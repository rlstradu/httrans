// js/state.js
// Shared mutable state for the whole app. Every other file reads and
// writes these top-level `let` bindings directly (the same way the
// original single-file version did) instead of holding its own copy.
// Must load right after translations.js — every other file just refers to
// these bare identifiers, relying on classic <script> tags sharing one
// global scope (see js/main.js for why this is plain classic scripts, not
// ES modules).

let translationMemory = [];
let tmSourceLanguage = '';
let tmTargetLanguage = '';
let currentLanguage = 'es';
let historyStack = [];
// Light/dark theme, persisted independently of everything else above
// (same localStorage-based approach PandaTerm uses for its own theme).
let currentTheme = localStorage.getItem('pandoriaTheme') || 'light';
