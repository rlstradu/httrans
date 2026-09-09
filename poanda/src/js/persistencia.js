/**
 * Puente entre lo que hay en pantalla y lo que se guarda en el navegador.
 *
 * El editor trabaja siempre sobre `state.poEntries`, en memoria. Este módulo se
 * encarga de que eso acabe en la base de datos sin reescribirlo todo cada vez.
 *
 * Cómo lo hace: guarda una copia de lo último que escribió en disco y, cada vez
 * que le toca sincronizar, compara. Solo se escriben las filas cuya traducción
 * ha cambiado de verdad. Si no has tocado nada, no se escribe nada.
 *
 * Se hace por comparación, y no llamando a guardar en cada sitio donde el editor
 * modifica un texto, porque esos sitios son seis y van desde validar un segmento
 * hasta reemplazar en todo el archivo. Bastaría olvidarse de uno para perder
 * cambios en silencio. Comparando, da igual quién haya tocado qué.
 */
import { crearProyecto, podarProyectosViejos, separarEntradas } from './projects.js';
import { MAXIMO_GUARDADOS, db } from './db.js';
import { state } from './state.js';

/**
 * Última foto de lo escrito en disco: clave "entrada:segmento" -> traducción.
 * Sirve para saber qué ha cambiado sin tener que releer la base de datos.
 * @type {Map<string, string>}
 */
let ultimoGuardado = new Map();

const clave = (entryIndex, sentenceIndex) => `${entryIndex}:${sentenceIndex}`;

/**
 * Registra en la base de datos el archivo que se acaba de abrir.
 *
 * @param {Object} datos
 * @param {string} datos.fileName
 * @param {string} datos.format Identificador del formato ('po', 'txt'...).
 * @param {string} [datos.rawHtml] HTML original, en los proyectos HTML.
 * @param {string} [datos.contenidoOriginal] Contenido con el que se abrió el
 *   archivo. Lo necesitan los formatos que reconstruyen sobre el original para
 *   devolver intacto lo que no se traduce; sin esto, un proyecto guardado y
 *   vuelto a abrir se exportaría perdiendo comentarios y líneas en blanco.
 * @returns {Promise<number|null>} Identificador del proyecto, o null si falla.
 */
export async function registrarProyectoAbierto({
    fileName,
    format,
    rawHtml = '',
    contenidoOriginal = '',
}) {
    try {
        const projectId = await crearProyecto({
            fileName,
            format,
            entradas: state.poEntries,
            sourceLang: state.sourceLang || '',
            targetLang: state.targetLang || '',
            rawHtml,
            contenidoOriginal,
        });

        state.projectId = projectId;
        tomarFoto();

        // Se poda al abrir, que es el único momento en que la base crece de
        // golpe. Va sin await a propósito: borrar proyectos viejos no puede
        // hacer esperar a quien acaba de abrir un archivo.
        podarProyectosViejos(MAXIMO_GUARDADOS).catch((error) => {
            console.error('No se han podido borrar los proyectos más antiguos:', error);
        });

        return projectId;
    } catch (error) {
        // Que no se pueda guardar no debe impedir traducir: el trabajo sigue en
        // memoria y la copia de seguridad de sesión sigue funcionando.
        console.error('No se ha podido registrar el proyecto:', error);
        state.projectId = null;
        return null;
    }
}

/** Guarda la foto de lo que hay ahora en pantalla como "ya escrito en disco". */
function tomarFoto() {
    ultimoGuardado = new Map();
    const { segmentos } = separarEntradas(state.poEntries);
    for (const s of segmentos) {
        ultimoGuardado.set(clave(s.entryIndex, s.sentenceIndex), s.translation);
    }
}

/**
 * Escribe en la base de datos solo los segmentos cuya traducción ha cambiado.
 *
 * @returns {Promise<number>} Cuántos segmentos se han escrito.
 */
export async function sincronizarCambios() {
    if (!state.projectId) return 0;

    const { segmentos } = separarEntradas(state.poEntries);
    const cambiados = segmentos.filter(
        (s) => ultimoGuardado.get(clave(s.entryIndex, s.sentenceIndex)) !== s.translation,
    );

    if (cambiados.length === 0) return 0;

    try {
        const filas = await db.segments.where('projectId').equals(state.projectId).toArray();
        const porClave = new Map(filas.map((f) => [clave(f.entryIndex, f.sentenceIndex), f]));

        const actualizaciones = [];
        for (const s of cambiados) {
            const fila = porClave.get(clave(s.entryIndex, s.sentenceIndex));
            if (!fila) continue;
            actualizaciones.push({
                key: fila.id,
                changes: {
                    translation: s.translation,
                    wordCountTranslation: s.wordCountTranslation,
                    // Se deduce del texto en vez de fiarse de la marca que trae
                    // el editor: son dos campos que hay que mantener a la vez y
                    // basta con que alguien actualice uno para que queden
                    // descuadrados. Es el mismo criterio que usa projects.js.
                    isTranslated: s.translation.trim() !== '' ? 1 : 0,
                },
            });
        }

        if (actualizaciones.length > 0) {
            await db.segments.bulkUpdate(actualizaciones);
            await db.projects.update(state.projectId, { lastModified: Date.now() });
        }

        for (const s of cambiados) {
            ultimoGuardado.set(clave(s.entryIndex, s.sentenceIndex), s.translation);
        }

        return actualizaciones.length;
    } catch (error) {
        console.error('No se han podido guardar los cambios del proyecto:', error);
        return 0;
    }
}

/**
 * ¿Hay algo escrito que todavía no esté en la base de datos?
 *
 * Se responde con la misma foto que usa sincronizarCambios, así que no hace
 * falta tocar la base para saberlo: es una comparación en memoria y se puede
 * llamar desde el aviso de cerrar la pestaña, donde el navegador no da tiempo
 * a esperar nada.
 *
 * Sin proyecto registrado la foto está vacía, así que cualquier traducción
 * cuenta como pendiente. Es lo correcto: si el proyecto no llegó a crearse,
 * en la base no hay nada.
 *
 * @returns {boolean}
 */
export function haySinGuardar() {
    if (!state.poEntries || state.poEntries.length === 0) return false;

    const { segmentos } = separarEntradas(state.poEntries);
    return segmentos.some(
        (s) => ultimoGuardado.get(clave(s.entryIndex, s.sentenceIndex)) !== s.translation,
    );
}

/**
 * Guarda la nota que ha escrito quien traduce en un segmento.
 *
 * Va aparte de sincronizarCambios porque no es una traducción: se escribe de
 * una en una, cuando se cierra el cuadro de comentarios, y no hace falta
 * comparar nada. Si no hay proyecto abierto (aún no se ha guardado el archivo),
 * la nota se queda en memoria y entra en la base cuando el proyecto se cree.
 *
 * @param {number} entryIndex
 * @param {number} sentenceIndex
 * @param {string} nota
 * @returns {Promise<boolean>} Si ha llegado a escribirse.
 */
export async function guardarNota(entryIndex, sentenceIndex, nota) {
    if (!state.projectId) return false;

    try {
        const fila = await db.segments
            .where('[projectId+entryIndex]')
            .equals([state.projectId, entryIndex])
            .and((s) => s.sentenceIndex === sentenceIndex)
            .first();

        if (!fila) return false;

        await db.segments.update(fila.id, { nota });
        await db.projects.update(state.projectId, { lastModified: Date.now() });
        return true;
    } catch (error) {
        console.error('No se ha podido guardar el comentario del segmento:', error);
        return false;
    }
}

/**
 * Olvida el proyecto en curso. Se llama al empezar uno nuevo.
 *
 * No borra nada de la base de datos: el proyecto sigue estando en la lista de
 * recientes, simplemente deja de ser el que se está editando.
 */
export function olvidarProyecto() {
    state.projectId = null;
    ultimoGuardado = new Map();
}

/**
 * Deja el módulo apuntando a un proyecto ya guardado, sin volver a escribirlo.
 * Se usa al abrir un proyecto desde la lista de recientes.
 *
 * @param {number} projectId
 */
export function adoptarProyecto(projectId) {
    state.projectId = projectId;
    tomarFoto();
}
