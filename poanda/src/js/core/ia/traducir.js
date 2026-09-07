/**
 * Traducir con IA: un segmento, o muchos.
 *
 * Aquí se junta todo lo demás: se protegen las etiquetas, se monta el encargo,
 * se llama al servicio, se comprueba lo que ha devuelto y se descarta si no
 * cuadra. La regla que gobierna el módulo entero:
 *
 *   **una traducción que no conserva las etiquetas del original no se guarda.**
 *
 * Es preferible un segmento vacío, que se ve de un vistazo en la lista y en las
 * estadísticas, a un segmento traducido que rompe el archivo, que no se ve
 * hasta que el cliente lo instala.
 */
import { perfilDeFormato } from '../etiquetas.js';
import { ponerMarcas, quitarMarcas } from './marcadores.js';
import { encargoDeAyudar, encargoDeTraducir, leerVariasTraducciones } from './prompt.js';
import { conversar } from './proveedores.js';

/** Cuántos segmentos van en cada petición al pretraducir. */
export const POR_LOTE = 10;

/** Cuántas peticiones a la vez. */
export const A_LA_VEZ = 4;

/** Cuántas veces se reintenta un lote que ha fallado. */
const REINTENTOS = 2;

/**
 * Comprueba que una traducción se puede guardar.
 *
 * @param {string} original El original, sin marcas.
 * @param {string} traduccion Lo que ha devuelto el modelo, ya sin marcas.
 * @param {{bien: boolean, problema: string}} devolucion Resultado de quitar las marcas.
 * @returns {{vale: boolean, motivo: string}}
 */
export function revisarTraduccion(original, traduccion, devolucion) {
    if (!devolucion.bien) return { vale: false, motivo: `etiquetas: ${devolucion.problema}` };

    const limpia = String(traduccion || '').trim();
    if (!limpia) return { vale: false, motivo: 'respuesta vacía' };

    // Un modelo que devuelve el original tal cual no ha traducido nada; guardarlo
    // dejaría el archivo "traducido" en el idioma de partida, que es peor que
    // dejarlo vacío porque nadie lo revisa.
    if (limpia === String(original || '').trim() && limpia.length > 12) {
        return { vale: false, motivo: 'ha devuelto el original' };
    }

    // Las señales de que el modelo se ha puesto a charlar en lugar de traducir.
    if (/^(lo siento|no puedo|as an ai|i cannot|here'?s the translation)/i.test(limpia)) {
        return { vale: false, motivo: 'ha contestado en vez de traducir' };
    }

    return { vale: true, motivo: '' };
}

/**
 * Traduce un solo texto.
 *
 * @param {Object} datos
 * @param {string} datos.original
 * @param {Object} datos.config Configuración del proveedor.
 * @param {string} datos.formato Para saber qué etiquetas buscar.
 * @param {string} [datos.idiomaOrigen]
 * @param {string} [datos.idiomaDestino]
 * @param {Object} [datos.contexto]
 * @param {{senal?: AbortSignal, fetchImpl?: Function}} [opciones]
 * @returns {Promise<{traduccion: string, vale: boolean, motivo: string}>}
 */
export async function traducirUno(datos, opciones = {}) {
    const perfil = perfilDeFormato(datos.formato);
    const conMarcas = ponerMarcas(datos.original, perfil);

    const respuesta = await conversar(
        datos.config,
        encargoDeTraducir({
            originales: [conMarcas.texto],
            idiomaOrigen: datos.idiomaOrigen,
            idiomaDestino: datos.idiomaDestino,
            contexto: datos.contexto,
        }),
        { ...opciones, temperatura: 0.2 },
    );

    const devuelto = quitarMarcas(respuesta, conMarcas.etiquetas);
    const revision = revisarTraduccion(datos.original, devuelto.texto, devuelto);

    return { traduccion: devuelto.texto, vale: revision.vale, motivo: revision.motivo };
}

/**
 * Traduce un grupo de textos en una sola petición.
 *
 * @param {Object} datos
 * @param {string[]} datos.originales
 * @param {Object} datos.config
 * @param {string} datos.formato
 * @param {string} [datos.idiomaOrigen]
 * @param {string} [datos.idiomaDestino]
 * @param {Object} [datos.contexto]
 * @param {{senal?: AbortSignal, fetchImpl?: Function}} [opciones]
 * @returns {Promise<Array<{traduccion: string, vale: boolean, motivo: string}>>}
 *   Uno por cada original, en el mismo orden.
 */
export async function traducirLote(datos, opciones = {}) {
    const perfil = perfilDeFormato(datos.formato);
    const conMarcas = datos.originales.map((texto) => ponerMarcas(texto, perfil));

    const respuesta = await conversar(
        datos.config,
        encargoDeTraducir({
            originales: conMarcas.map((m) => m.texto),
            idiomaOrigen: datos.idiomaOrigen,
            idiomaDestino: datos.idiomaDestino,
            contexto: datos.contexto,
        }),
        { ...opciones, temperatura: 0.2 },
    );

    const lista = leerVariasTraducciones(respuesta, datos.originales.length);

    // Si la respuesta no se entiende, el lote entero se da por fallido en lugar
    // de intentar adivinar qué traducción va con qué segmento: colocar una
    // traducción en el segmento equivocado es el peor de los fallos posibles,
    // porque el archivo queda plausible y mal.
    if (!lista) {
        return datos.originales.map(() => ({
            traduccion: '',
            vale: false,
            motivo: 'respuesta desordenada',
        }));
    }

    return lista.map((texto, i) => {
        const devuelto = quitarMarcas(texto, conMarcas[i].etiquetas);
        const revision = revisarTraduccion(datos.originales[i], devuelto.texto, devuelto);
        return { traduccion: devuelto.texto, vale: revision.vale, motivo: revision.motivo };
    });
}

/**
 * Contesta una consulta.
 *
 * @param {Object} datos
 * @param {string} datos.pregunta
 * @param {Object} datos.config
 * @param {Array} [datos.conversacion]
 * @param {Object} [datos.segmento]
 * @param {Object} [datos.contexto]
 * @param {{senal?: AbortSignal, fetchImpl?: Function}} [opciones]
 * @returns {Promise<string>}
 */
export async function preguntar(datos, opciones = {}) {
    return conversar(
        datos.config,
        encargoDeAyudar({
            conversacion: datos.conversacion,
            pregunta: datos.pregunta,
            segmento: datos.segmento,
            contexto: datos.contexto,
        }),
        // Algo más de soltura que al traducir: aquí se busca una explicación
        // útil, no la misma frase palabra por palabra.
        { ...opciones, temperatura: 0.4 },
    );
}

export { REINTENTOS };
