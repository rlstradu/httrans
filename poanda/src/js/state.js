/**
 * Estado compartido de Poanda.
 *
 * Todo lo que varias partes de la aplicación leen y modifican vive aquí, en un
 * único objeto. Antes eran variables globales sueltas; al pasar a módulos ES
 * cada archivo tiene su propio ámbito, así que el estado común necesita un sitio
 * propio y explícito.
 */

export const state = {
    poEntries: [],
    undoStack: [],
    currentFileName: 'translations.po',
    currentLanguage: 'en',
    findState: {
        query: '',
        replace: '',
        caseSensitive: false,
        useRegex: false,
        lastFound: null,
    },
    searchResults: [],
    currentSearchIndex: -1,
    currentFileType: null,
    currentJsonSourceFileName: null,
    currentJsonTargetFileName: null,
    currentHtmlDoc: null,
    htmlNodeMap: [],
    currentRawHtml: '',
    termsFoundInActiveSegment: new Set(),
    glossary: [],
    glossarySourceLanguage: '',
    glossaryTargetLanguage: '',
    currentGlossaryLatestResults: [],
    translationMemory: [],
    tmSourceLanguage: '',
    tmTargetLanguage: '',
    tmBestMatchForActiveSegment: null,
    currentTMLatestSearchResults: [],
    lastFocusedSegment: null,
    // Se comprueba que localStorage exista para que los módulos de lógica pura
    // se puedan cargar también fuera del navegador (los tests corren en Node).
    aiApiKey: typeof localStorage !== 'undefined' ? localStorage.getItem('poanda_gemini_key') || '' : '',
    lastAiResponseText: '',
    shortcutConfig: {},
    tempShortcutConfig: {},
};
