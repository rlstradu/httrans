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

/**
 * Cuántos proyectos se enseñan en la lista de recientes.
 *
 * Eran cinco, y eso no era una lista de recientes: era una ventana de cinco.
 * El sexto proyecto no se borraba —seguía entero en la base de datos— sino que
 * dejaba de aparecer, y sin manera de llegar a él. Volver a un encargo del mes
 * pasado era imposible aunque estuviera guardado.
 */
export const MAXIMO_RECIENTES = 25;

/**
 * Cuántos se conservan de verdad. Pasado ese número, los más viejos se borran.
 *
 * Esto antes no lo hacía nadie: la función de podar existía y no la llamaba
 * ningún sitio, así que la base de datos crecía sin fin hasta que el navegador
 * se negaba a escribir —y ese fallo se tragaba en silencio, con lo que el
 * trabajo dejaba de guardarse sin decir nada.
 *
 * El número es holgado a propósito: se borra bastante más allá de lo que se
 * enseña, para que podar nunca se lleve por delante algo que estaba a la vista.
 */
export const MAXIMO_GUARDADOS = 50;
