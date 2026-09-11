/**
 * Estado compartido de subpandaTM.
 *
 * Aquí vive lo que leen y modifican varias partes de la herramienta a la vez.
 * Mientras todo estaba en un solo archivo eran variables sueltas en el ámbito
 * global; con módulos, cada archivo tiene el suyo, así que el estado común
 * necesita un sitio propio y explícito.
 *
 * Es el mismo objeto que usa Poanda, con los mismos nombres, para que el
 * glosario y la memoria sean literalmente el mismo código en las dos
 * herramientas. Lo que cambia es qué se traduce: allí son segmentos de un
 * archivo PO, aquí son subtítulos.
 */
export const state = {
    /** El proyecto abierto en la base de datos. null mientras no haya ninguno. */
    projectId: null,

    /** Los subtítulos. Es el equivalente de poEntries en Poanda. */
    srtEntries: [],

    currentFileName: 'subtitles.srt',
    currentLanguage: 'en',

    /**
     * El par de idiomas del proyecto: de qué idioma a qué idioma va este
     * archivo.
     *
     * Antes había dos pares, uno del glosario y otro de la memoria, y cada uno
     * se configuraba por su lado. Eran el mismo dato escrito dos veces, se
     * podían contradecir, y no había forma de saber a cuál hacer caso. Un
     * archivo se traduce en una dirección: esa dirección es del proyecto.
     */
    sourceLang: '',
    targetLang: '',

    /** Los términos del glosario que están en el subtítulo que se tiene delante. */
    termsFoundInActiveSegment: new Set(),

    glossary: [],
    currentGlossaryLatestResults: [],

    translationMemory: [],
    tmBestMatchForActiveSegment: null,
    currentTMLatestSearchResults: [],

    /** El último subtítulo en el que estuvo el cursor, para saber dónde insertar. */
    lastFocusedSegment: null,
};
