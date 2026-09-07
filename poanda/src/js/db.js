import Dexie from 'dexie';

/**
 * Base de datos local de Poanda.
 *
 * Todo lo que Poanda guarda se queda en el navegador de quien la usa: no hay
 * servidor ni se envía nada a ninguna parte. Dexie es una capa fina sobre
 * IndexedDB, el almacén que traen los navegadores.
 *
 * IMPORTANTE — compatibilidad: el nombre de la base ('PoandaBackup') y la tabla
 * 'session' vienen de antes de Dexie y no se pueden cambiar sin escribir una
 * migración: quien tenga una traducción a medias al actualizar la perdería.
 */
export const db = new Dexie('PoandaBackup');

/**
 * Versión 1 — la que existía antes de Dexie.
 *
 * Una sola tabla con un único registro que contenía la sesión entera: las
 * traducciones, el glosario y la memoria, todo junto. Cada autoguardado
 * reescribía el bloque completo, así que con archivos grandes se volvía pesado.
 */
db.version(1).stores({
    session: 'id',
});

/**
 * Versión 2 — proyectos y segmentos por separado.
 *
 * El cambio de fondo: cada segmento pasa a ser una fila propia. Guardar una
 * traducción deja de reescribir el proyecto entero para escribir solo la fila
 * que ha cambiado, que es lo que permite trabajar con archivos de miles de
 * cadenas sin que la herramienta se atasque.
 *
 * La tabla 'session' se mantiene: la copia de seguridad de la versión anterior
 * sigue funcionando mientras el editor no esté migrado, y así nadie pierde nada
 * por actualizar a medias.
 */
db.version(2).stores({
    session: 'id',

    // Un proyecto es un archivo abierto: su nombre, sus idiomas y los datos que
    // no cambian mientras se traduce (comentarios, contextos, textos originales).
    projects: '++id, fileName, format, sourceLang, targetLang, createdAt, lastModified',

    // Un segmento es una unidad traducible. Es lo único que cambia sin parar
    // mientras se trabaja, y por eso vive en filas independientes.
    segments: '++id, projectId, entryIndex, sentenceIndex, isTranslated, [projectId+entryIndex]',

    // Memoria de traducción y glosario, cada uno atado a su proyecto.
    tm: '++id, projectId, srcText, srcLang, tgtLang, [projectId+srcLang]',
    glossary: '++id, projectId, srcTerm, srcLang, tgtLang, [projectId+srcLang]',
});

/** Identificador del único registro de sesión del formato antiguo. */
export const ID_SESION = 'currentSession';

/** Cuántos proyectos recientes se conservan. Los más viejos se van borrando. */
export const MAXIMO_RECIENTES = 5;
