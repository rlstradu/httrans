/**
 * Estado compartido de Poanda.
 *
 * Todo lo que varias partes de la aplicación leen y modifican vive aquí, en un
 * único objeto. Antes eran variables globales sueltas; al pasar a módulos ES
 * cada archivo tiene su propio ámbito, así que el estado común necesita un sitio
 * propio y explícito.
 */

export const state = {
    // Identificador del proyecto abierto en la base de datos. null mientras no
    // se haya abierto ningún archivo.
    projectId: null,

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
    // Contenido con el que se abrió el archivo. Los formatos que reconstruyen
    // sobre el original lo necesitan para devolver intacto lo que no se traduce:
    // comentarios, líneas en blanco y todo lo que no era un segmento.
    contenidoOriginal: '',
    // El par de idiomas del proyecto: de qué idioma a qué idioma se traduce
    // este archivo. Se elige al abrirlo y se guarda con el proyecto.
    //
    // Antes había dos pares, uno del glosario y otro de la memoria, y cada uno
    // se configuraba por su lado. Eran el mismo dato escrito dos veces, se
    // podían contradecir, y el asistente de IA no tenía a cuál hacer caso. Un
    // archivo se traduce en una dirección: esa dirección es del proyecto.
    sourceLang: '',
    targetLang: '',
    termsFoundInActiveSegment: new Set(),
    glossary: [],
    currentGlossaryLatestResults: [],
    translationMemory: [],
    tmBestMatchForActiveSegment: null,
    currentTMLatestSearchResults: [],
    lastFocusedSegment: null,
    // Se comprueba que localStorage exista para que los módulos de lógica pura
    // se puedan cargar también fuera del navegador (los tests corren en Node).
    aiApiKey:
        typeof localStorage !== 'undefined' ? localStorage.getItem('poanda_gemini_key') || '' : '',
    lastAiResponseText: '',
    shortcutConfig: {},
    tempShortcutConfig: {},
};
