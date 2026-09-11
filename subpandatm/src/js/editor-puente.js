/**
 * El puente entre la columna de consulta y el editor.
 *
 * En Poanda el glosario y la memoria importan estas funciones directamente de
 * editor.js, porque allí el editor ya es un módulo. Aquí el editor sigue dentro
 * de app.js mientras se termina de trocear, y si el glosario importara de
 * app.js y app.js del glosario tendríamos dos módulos que se importan el uno al
 * otro: eso carga, pero deja a medio inicializar lo que se use durante la
 * carga, y falla de formas difíciles de leer.
 *
 * Así que app.js dice aquí cómo se hacen estas cuatro cosas, y el glosario y la
 * memoria las piden sin saber quién las hace. Cuando el editor sea su propio
 * módulo, este archivo desaparece.
 */

/** Lo que app.js registra al arrancar. */
const puente = {
    /** @type {() => {entryIndex: number, segmentIndex: number}|null} */
    dondeEstaElCursor: () => null,
    /** @type {(texto: string, opciones?: {sustituir?: boolean}) => boolean} */
    insertarEnElSegmento: () => false,
    /** @type {() => void} */
    repintarTodo: () => {},
    /** @type {() => void} */
    repintarOriginales: () => {},
    /** @type {() => void} */
    recalcularTerminos: () => {},
};

/** @param {Partial<typeof puente>} funciones */
export function conectarElEditor(funciones) {
    Object.assign(puente, funciones);
}

/**
 * En qué subtítulo está el cursor.
 *
 * Devuelve la misma forma que en Poanda ({entryIndex, segmentIndex}) aunque
 * aquí un subtítulo sea siempre un solo segmento: así el glosario y la memoria
 * son el mismo código en las dos herramientas.
 */
export const getCurrentFocusedIndex = () => puente.dondeEstaElCursor();

/**
 * Mete un texto en la traducción del subtítulo activo.
 *
 * Con `sustituir` se cambia la traducción entera —es lo que hace falta con una
 * coincidencia de la memoria, que trae la frase completa—; sin él se inserta
 * donde esté el cursor, que es lo que hace falta con un término del glosario.
 *
 * @param {string} texto
 * @param {{sustituir?: boolean}} [opciones]
 * @returns {boolean} Si se ha conseguido.
 */
export const insertarEnElSegmento = (texto, opciones) =>
    puente.insertarEnElSegmento(texto, opciones);

/** Vuelve a pintar la lista entera de subtítulos. */
export const renderTranslations = () => puente.repintarTodo();

/**
 * Vuelve a pintar el original de todos los subtítulos.
 *
 * El amarillo del glosario está en todo el archivo, así que añadir o quitar un
 * término cambia lo que se ve de arriba abajo, no solo en el subtítulo activo.
 */
export const repintarTodosLosOriginales = () => puente.repintarOriginales();

/**
 * Vuelve a mirar qué términos hay en el subtítulo en el que se está.
 *
 * El panel señala las coincidencias a partir de esa lista: sin rehacerla, un
 * término recién guardado no sale marcado hasta salir del subtítulo y volver.
 */
export const recalcularTerminosDelSegmentoActivo = () => puente.recalcularTerminos();
