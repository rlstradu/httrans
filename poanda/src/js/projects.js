/**
 * Guardado y recuperación de proyectos.
 *
 * Un "proyecto" es un archivo abierto en Poanda con todo lo que lo acompaña:
 * sus segmentos, su glosario y su memoria de traducción. Vive en el navegador
 * de quien traduce, nunca sale de ahí.
 *
 * El reparto de responsabilidades es el que importa aquí:
 *
 * - En la fila del proyecto va lo que NO cambia mientras se traduce: el nombre
 *   del archivo, los idiomas, y los datos de cada entrada del PO (comentarios,
 *   contexto, texto original, marca de "fuzzy"). Se escribe una vez, al abrir.
 * - En filas de segmento va lo ÚNICO que cambia todo el rato: la traducción.
 *
 * Antes, cada autoguardado reescribía el proyecto entero. Ahora, escribir una
 * traducción toca una sola fila. Esa es toda la diferencia, y es la que se nota
 * con archivos de miles de cadenas.
 */
import { db, MAXIMO_RECIENTES } from './db.js';

/**
 * Separa la lista de entradas del editor en dos partes: los datos fijos de cada
 * entrada y los segmentos traducibles.
 *
 * @param {Array<Object>} entradas Entradas tal y como las usa el editor.
 * @returns {{meta: Array<Object>, segmentos: Array<Object>}}
 */
export function separarEntradas(entradas) {
    const meta = [];
    const segmentos = [];

    (entradas || []).forEach((entrada, entryIndex) => {
        meta.push({
            comments: entrada.comments || [],
            msgctxt: entrada.msgctxt,
            msgid: entrada.msgid,
            fuzzy: Boolean(entrada.fuzzy),
            isHeader: Boolean(entrada.isHeader),
            msgstr: entrada.isHeader ? entrada.msgstr || '' : undefined,
        });

        const trozos = entrada.sentenceSegments || [];
        trozos.forEach((segmento, sentenceIndex) => {
            segmentos.push({
                entryIndex,
                sentenceIndex,
                original: segmento.original || '',
                translation: segmento.translation || '',
                wordCountOriginal: segmento.wordCountOriginal || 0,
                wordCountTranslation: segmento.wordCountTranslation || 0,
                isTranslated: segmento.isTranslated ? 1 : 0,
            });
        });
    });

    return { meta, segmentos };
}

/**
 * Vuelve a montar la lista de entradas del editor a partir de lo guardado.
 *
 * Es la operación inversa de separarEntradas.
 *
 * @param {Array<Object>} meta Datos fijos de cada entrada.
 * @param {Array<Object>} segmentos Filas de segmento, en cualquier orden.
 * @returns {Array<Object>} Entradas listas para el editor.
 */
export function reunirEntradas(meta, segmentos) {
    const porEntrada = new Map();
    for (const s of segmentos || []) {
        if (!porEntrada.has(s.entryIndex)) porEntrada.set(s.entryIndex, []);
        porEntrada.get(s.entryIndex).push(s);
    }

    return (meta || []).map((datos, entryIndex) => {
        const trozos = (porEntrada.get(entryIndex) || [])
            .slice()
            .sort((a, b) => a.sentenceIndex - b.sentenceIndex)
            .map((s) => ({
                original: s.original,
                translation: s.translation,
                wordCountOriginal: s.wordCountOriginal,
                wordCountTranslation: s.wordCountTranslation,
                isTranslated: Boolean(s.isTranslated),
            }));

        const entrada = {
            comments: datos.comments || [],
            msgid: datos.msgid,
            fuzzy: datos.fuzzy,
            isHeader: datos.isHeader,
            sentenceSegments: trozos,
        };
        if (datos.msgctxt !== undefined) entrada.msgctxt = datos.msgctxt;
        // En la cabecera, msgstr se guarda tal cual; en el resto se reconstruye
        // uniendo los segmentos.
        entrada.msgstr = datos.isHeader
            ? datos.msgstr || ''
            : trozos.map((t) => t.translation).join('');

        return entrada;
    });
}

/**
 * Crea un proyecto nuevo con sus segmentos.
 *
 * @param {Object} datos
 * @param {string} datos.fileName Nombre del archivo abierto.
 * @param {string} datos.format 'po', 'json' o 'html'.
 * @param {Array<Object>} datos.entradas Entradas del editor.
 * @param {string} [datos.sourceLang]
 * @param {string} [datos.targetLang]
 * @param {string} [datos.rawHtml] HTML original, solo para proyectos HTML.
 * @returns {Promise<number>} Identificador del proyecto creado.
 */
export async function crearProyecto({
    fileName,
    format,
    entradas,
    sourceLang = '',
    targetLang = '',
    rawHtml = '',
}) {
    const { meta, segmentos } = separarEntradas(entradas);
    const ahora = Date.now();

    return db.transaction('rw', db.projects, db.segments, async () => {
        const projectId = await db.projects.add({
            fileName,
            format,
            sourceLang,
            targetLang,
            rawHtml,
            entriesMeta: meta,
            createdAt: ahora,
            lastModified: ahora,
        });

        await db.segments.bulkAdd(segmentos.map((s) => ({ ...s, projectId })));
        return projectId;
    });
}

/**
 * Guarda la traducción de un segmento.
 *
 * Esta es la operación que se ejecuta constantemente mientras se traduce, y por
 * eso escribe una sola fila en lugar del proyecto entero.
 *
 * @param {number} projectId
 * @param {number} entryIndex Posición de la entrada en el archivo.
 * @param {number} sentenceIndex Posición del segmento dentro de la entrada.
 * @param {string} translation Texto traducido.
 * @param {Object} [extra] Campos adicionales, como el recuento de palabras.
 * @returns {Promise<void>}
 */
export async function guardarTraduccion(
    projectId,
    entryIndex,
    sentenceIndex,
    translation,
    extra = {},
) {
    const fila = await db.segments
        .where('[projectId+entryIndex]')
        .equals([projectId, entryIndex])
        .and((s) => s.sentenceIndex === sentenceIndex)
        .first();

    if (!fila) return;

    await db.segments.update(fila.id, {
        translation,
        isTranslated: translation.trim() !== '' ? 1 : 0,
        ...extra,
    });
    await db.projects.update(projectId, { lastModified: Date.now() });
}

/**
 * Recupera un proyecto entero, listo para abrirlo en el editor.
 *
 * @param {number} projectId
 * @returns {Promise<Object|null>} El proyecto con sus entradas, o null.
 */
export async function abrirProyecto(projectId) {
    const proyecto = await db.projects.get(projectId);
    if (!proyecto) return null;

    const segmentos = await db.segments.where('projectId').equals(projectId).toArray();

    return {
        id: proyecto.id,
        fileName: proyecto.fileName,
        format: proyecto.format,
        sourceLang: proyecto.sourceLang,
        targetLang: proyecto.targetLang,
        rawHtml: proyecto.rawHtml || '',
        lastModified: proyecto.lastModified,
        entradas: reunirEntradas(proyecto.entriesMeta, segmentos),
    };
}

/**
 * Lista los proyectos recientes, del más reciente al más antiguo.
 *
 * @param {number} [maximo]
 * @returns {Promise<Array<Object>>} Datos de cabecera, sin los segmentos.
 */
export async function listarRecientes(maximo = MAXIMO_RECIENTES) {
    const filas = await db.projects.toArray();

    return filas
        .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
        .slice(0, Math.max(0, maximo))
        .map((p) => ({
            id: p.id,
            fileName: p.fileName || 'Sin nombre',
            format: p.format || '',
            sourceLang: p.sourceLang || '',
            targetLang: p.targetLang || '',
            lastModified: p.lastModified || 0,
        }));
}

/**
 * Calcula el avance de un proyecto sin cargarlo entero.
 *
 * @param {number} projectId
 * @returns {Promise<{total: number, traducidos: number}>}
 */
export async function progresoDe(projectId) {
    const total = await db.segments.where('projectId').equals(projectId).count();
    const traducidos = await db.segments
        .where('projectId')
        .equals(projectId)
        .filter((s) => s.isTranslated === 1)
        .count();

    return { total, traducidos };
}

/**
 * Borra un proyecto y todo lo que cuelga de él.
 *
 * @param {number} projectId
 * @returns {Promise<void>}
 */
export async function borrarProyecto(projectId) {
    await db.transaction('rw', db.projects, db.segments, db.tm, db.glossary, async () => {
        await db.segments.where('projectId').equals(projectId).delete();
        await db.tm.where('projectId').equals(projectId).delete();
        await db.glossary.where('projectId').equals(projectId).delete();
        await db.projects.delete(projectId);
    });
}

/**
 * Deja solo los proyectos recientes y borra los demás.
 *
 * Sin esto, el navegador acumularía indefinidamente todos los archivos que se
 * hayan abierto alguna vez.
 *
 * @param {number} [maximo]
 * @returns {Promise<number>} Cuántos proyectos se han borrado.
 */
export async function podarProyectosViejos(maximo = MAXIMO_RECIENTES) {
    const filas = await db.projects.toArray();
    const sobrantes = filas
        .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
        .slice(Math.max(0, maximo));

    for (const p of sobrantes) {
        await borrarProyecto(p.id);
    }
    return sobrantes.length;
}
