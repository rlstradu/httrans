import Dexie from 'dexie';

/**
 * Base de datos local de subpandaTM.
 *
 * Todo lo que la herramienta guarda se queda en el navegador de quien la usa:
 * no hay servidor ni se envía nada a ninguna parte. Dexie es una capa fina
 * sobre IndexedDB, el almacén que traen los navegadores.
 *
 * IMPORTANTE — compatibilidad: el nombre de la base ('subpandaTM_v2') y la
 * versión 1 son los que ya están en el navegador de quien viene usando la
 * herramienta. No se pueden cambiar sin escribir una migración: quien tenga
 * una copia de seguridad con trabajo a medias la perdería.
 */
export const db = new Dexie('subpandaTM_v2');

/**
 * Versión 1 — la que había hasta ahora.
 *
 * Una tabla de proyectos (que en la práctica eran las copias de seguridad) y
 * otra de ajustes.
 */
db.version(1).stores({
    projects: '++id, fileName',
    settings: 'key',
});

/**
 * Versión 2 — memoria y glosario por proyecto.
 *
 * El cambio de fondo: la memoria y el glosario dejan de ser únicos para toda la
 * herramienta y pasan a ser de cada proyecto, como en cualquier herramienta
 * TAO. Antes, abrir el encargo de otro cliente te dejaba puesta la memoria del
 * anterior, y con dos clientes que traducen "file" de maneras distintas la
 * herramienta te proponía la del otro con toda su confianza. Esa clase de error
 * no se ve al revisar, porque parece una decisión propia.
 *
 * A la tabla de proyectos se le añaden los índices del par de idiomas y de la
 * fecha, que es lo que hace falta para ordenar la lista de recientes.
 */
db.version(2).stores({
    projects: '++id, fileName, sourceLang, targetLang, lastModified',
    settings: 'key',

    // Memoria de traducción y glosario, cada uno atado a su proyecto.
    tm: '++id, projectId, srcText, srcLang, tgtLang, [projectId+srcLang]',
    glossary: '++id, projectId, srcTerm, srcLang, tgtLang, [projectId+srcLang]',
});

/**
 * Cuántos proyectos se enseñan en la lista de recientes.
 *
 * Es una lista de recientes de verdad, no una ventana de cinco: volver a un
 * encargo del mes pasado tiene que ser posible.
 */
export const MAXIMO_RECIENTES = 25;

/**
 * Cuántos se conservan de verdad. Pasados esos, los más viejos se borran.
 *
 * Sin podar, la base de datos crece sin fin hasta que el navegador se niega a
 * escribir; y ese fallo se traga en silencio, con lo que el trabajo deja de
 * guardarse sin decir nada. El número es holgado a propósito: se borra bastante
 * más allá de lo que se enseña, para que podar nunca se lleve por delante algo
 * que estaba a la vista.
 */
export const MAXIMO_GUARDADOS = 50;
