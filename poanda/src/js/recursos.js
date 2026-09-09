/**
 * La memoria y el glosario de cada proyecto.
 *
 * Hasta ahora había una sola memoria y un solo glosario para todo. No es que
 * estuviera mal guardado: es que no estaban guardados en ningún sitio propio.
 * Las tablas existían en la base de datos desde el principio, con su columna de
 * proyecto y todo, y no las escribía nadie; lo único que se guardaba era la
 * copia de sesión, que es una sola y la machaca el proyecto que esté abierto.
 *
 * Lo que se veía desde fuera: abrías el encargo de otro cliente y te llevabas
 * puesta la memoria del anterior. Con dos clientes que traducen "file" de
 * maneras distintas, la herramienta te propone la del otro con toda su
 * confianza, y esa clase de error no se ve al revisar porque parece una
 * decisión propia.
 *
 * Ahora cada proyecto tiene la suya, como en cualquier herramienta TAO. Para
 * llevarse trabajo de un encargo a otro está la exportación a TMX y TBX, que es
 * el camino de siempre y funciona con las demás herramientas.
 */
import { db } from './db.js';
import { state } from './state.js';

/**
 * Si hay algo que escribir.
 *
 * Se marca desde los dos únicos sitios que tocan estas listas: al validar un
 * segmento (la memoria) y al añadir, editar o borrar un término (el glosario).
 * Son dos embudos, y por eso basta con una marca en lugar de comparar las
 * listas enteras cada diez segundos.
 */
let hayCambios = false;

/** Avisa de que la memoria o el glosario han cambiado. */
export function marcarRecursosCambiados() {
    hayCambios = true;
}

/** Olvida lo pendiente. Se llama al cambiar de proyecto. */
export function olvidarRecursosPendientes() {
    hayCambios = false;
}

/** ¿Queda algo de la memoria o el glosario sin escribir? */
export function hayRecursosSinGuardar() {
    return hayCambios;
}

/**
 * Escribe la memoria y el glosario del proyecto abierto.
 *
 * Se borra lo que había y se vuelve a escribir entero. Es más simple que
 * averiguar qué unidad concreta cambió, y estas dos listas son pequeñas al lado
 * de los segmentos: un glosario son decenas de términos y la memoria de un
 * encargo, unos miles de unidades.
 *
 * @returns {Promise<{memoria: number, glosario: number}|null>} Lo escrito, o
 *   null si no había proyecto o no había nada que escribir.
 */
export async function guardarRecursos() {
    if (!state.projectId || !hayCambios) return null;

    const projectId = state.projectId;
    const memoria = state.translationMemory || [];
    const glosario = state.glossary || [];

    try {
        await db.transaction('rw', db.tm, db.glossary, async () => {
            await db.tm.where('projectId').equals(projectId).delete();
            await db.glossary.where('projectId').equals(projectId).delete();

            if (memoria.length) {
                await db.tm.bulkAdd(memoria.map((u) => ({ ...u, projectId })));
            }
            if (glosario.length) {
                await db.glossary.bulkAdd(glosario.map((t) => ({ ...t, projectId })));
            }
        });

        hayCambios = false;
        return { memoria: memoria.length, glosario: glosario.length };
    } catch (error) {
        // Que no se pueda guardar la memoria no puede impedir traducir: sigue
        // en pantalla y se reintenta al siguiente ciclo.
        console.error('No se han podido guardar la memoria y el glosario:', error);
        return null;
    }
}

/**
 * Lee la memoria y el glosario de un proyecto.
 *
 * @param {number} projectId
 * @returns {Promise<{memoria: Array<object>, glosario: Array<object>}>}
 */
export async function cargarRecursos(projectId) {
    if (!projectId) return { memoria: [], glosario: [] };

    try {
        const [memoria, glosario] = await Promise.all([
            db.tm.where('projectId').equals(projectId).toArray(),
            db.glossary.where('projectId').equals(projectId).toArray(),
        ]);

        // El id de la fila y el del proyecto son cosas de la base de datos; lo
        // que sale de aquí tiene que ser exactamente lo que el editor espera,
        // o acabarían viajando dentro de un TMX exportado.
        const limpiar = ({ id, projectId: _p, ...resto }) => resto;

        return { memoria: memoria.map(limpiar), glosario: glosario.map(limpiar) };
    } catch (error) {
        console.error('No se han podido leer la memoria y el glosario:', error);
        return { memoria: [], glosario: [] };
    }
}

/**
 * Deja en pantalla la memoria y el glosario de un proyecto.
 *
 * @param {number} projectId
 */
export async function ponerRecursosDelProyecto(projectId) {
    const { memoria, glosario } = await cargarRecursos(projectId);
    state.translationMemory = memoria;
    state.glossary = glosario;
    hayCambios = false;
}

/** Deja las dos listas vacías, sin tocar la base de datos. */
export function vaciarRecursos() {
    state.translationMemory = [];
    state.glossary = [];
    hayCambios = false;
}
