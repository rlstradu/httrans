/**
 * Traducir con IA: un subtítulo, o muchos.
 *
 * Aquí se junta todo lo demás: se protegen las etiquetas, se calcula lo que
 * cabe, se monta el encargo, se llama al servicio, se comprueba lo que ha
 * devuelto y se descarta si no cuadra. La regla que gobierna el módulo entero:
 *
 *   **una traducción que no conserva las etiquetas del original no se guarda.**
 *
 * Es preferible un subtítulo vacío, que se ve de un vistazo en la lista, a uno
 * traducido que sale en pantalla con un `<i>` escrito con todas sus letras
 * encima de la cara de alguien.
 */
import { ponerMarcas, quitarMarcas } from './marcadores.js';
import { encargoDeTraducir, encargoDeAyudar, leerVariasTraducciones } from './prompt.js';
import { conversar, proveedorPorId } from './proveedores.js';

/**
 * ¿Hay que hablarle a este servicio como a un modelo pequeño?
 *
 * Los que corren en el propio ordenador lo son. La diferencia no es de matiz:
 * con las instrucciones largas y en español, un modelo de 3B devuelve una
 * paráfrasis del texto en vez de la traducción. Ver core/ia/prompt.js.
 *
 * @param {Object} config
 * @returns {boolean}
 */
function esPequeño(config) {
    return Boolean(proveedorPorId(config?.proveedor)?.local);
}

/** Cuántos subtítulos van en cada petición al pretraducir. */
export const POR_LOTE = 10;

/** Cuántas peticiones a la vez. */
export const A_LA_VEZ = 4;

/** Cuántas veces se reintenta un lote que ha fallado. */
const REINTENTOS = 2;

/** Cuántas líneas admite un subtítulo. */
const LINEAS = 2;

/**
 * Lo que cabe en un subtítulo, según su duración y los límites del proyecto.
 *
 * El total sale de los caracteres por segundo: un subtítulo de dos segundos con
 * un límite de 17 CPS admite 34 caracteres. Y no más de lo que quepa en dos
 * líneas, porque un subtítulo de tres líneas no es un subtítulo.
 *
 * @param {number} duracionMs
 * @param {{cpsLimit: number, charsPerLineLimit: number}} limites
 * @returns {{maxTotal: number, maxPorLinea: number}|null} Null si no hay
 *   duración con la que contar.
 */
export function loQueCabe(duracionMs, limites) {
    const cps = Number(limites?.cpsLimit) || 0;
    const porLinea = Number(limites?.charsPerLineLimit) || 0;
    if (!cps || !porLinea || !(duracionMs > 0)) return null;

    const porTiempo = Math.floor((duracionMs / 1000) * cps);
    const porEspacio = porLinea * LINEAS;

    return {
        // Nunca menos de una línea corta: con un subtítulo de medio segundo el
        // cálculo da ocho caracteres, y pedir ocho caracteres es pedir que se
        // invente algo. Más vale pasarse un poco y que se vea en rojo.
        maxTotal: Math.max(20, Math.min(porTiempo, porEspacio)),
        maxPorLinea: porLinea,
    };
}

/**
 * ¿Se pasa de largo esta traducción?
 *
 * @param {string} texto
 * @param {{maxTotal: number, maxPorLinea: number}} [limite]
 * @returns {boolean}
 */
export function seVaDeLargo(texto, limite) {
    if (!limite?.maxTotal) return false;

    const lineas = String(texto || '').split('\n');
    // El salto de línea no se cuenta: no ocupa sitio en pantalla.
    const total = lineas.join('').length;

    return total > limite.maxTotal || lineas.some((l) => l.length > limite.maxPorLinea);
}

/**
 * Comprueba que una traducción se puede guardar.
 *
 * Pasarse de largo NO la descarta: un subtítulo largo se lee, se ve en rojo en
 * la lista y se recorta en un momento. Un subtítulo vacío hay que traducirlo
 * entero. Lo que sí la descarta es lo que no tiene arreglo a ojo.
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

    // Un modelo que devuelve el original tal cual no ha traducido nada;
    // guardarlo dejaría el subtítulo "traducido" en el idioma de partida, que es
    // peor que dejarlo vacío porque nadie lo revisa.
    if (limpia === String(original || '').trim() && limpia.length > 12) {
        return { vale: false, motivo: 'ha devuelto el original' };
    }

    // Las señales de que el modelo se ha puesto a charlar en lugar de traducir.
    if (/^(lo siento|no puedo|as an ai|i cannot|here'?s the translation)/i.test(limpia)) {
        return { vale: false, motivo: 'ha contestado en vez de traducir' };
    }

    // Tres líneas no son un subtítulo, y eso no se arregla mirándolo: casi
    // siempre es que el modelo ha metido una explicación debajo.
    if (limpia.split('\n').length > LINEAS) {
        return { vale: false, motivo: 'más de dos líneas' };
    }

    return { vale: true, motivo: '' };
}

/**
 * Traduce un solo subtítulo.
 *
 * @param {Object} datos
 * @param {string} datos.original
 * @param {Object} datos.config Configuración del proveedor.
 * @param {string} [datos.idiomaOrigen]
 * @param {string} [datos.idiomaDestino]
 * @param {Object} [datos.contexto]
 * @param {{maxTotal: number, maxPorLinea: number}} [datos.limite]
 * @param {{senal?: AbortSignal, fetchImpl?: Function}} [opciones]
 * @returns {Promise<{traduccion: string, vale: boolean, motivo: string, seVaDeLargo: boolean}>}
 */
export async function traducirUno(datos, opciones = {}) {
    const conMarcas = ponerMarcas(datos.original);

    const pedir = (limite) =>
        conversar(
            datos.config,
            encargoDeTraducir({
                originales: [conMarcas.texto],
                idiomaOrigen: datos.idiomaOrigen,
                idiomaDestino: datos.idiomaDestino,
                contexto: datos.contexto,
                limites: limite ? [limite] : undefined,
                corto: esPequeño(datos.config),
            }),
            { ...opciones, temperatura: 0.2 },
        );

    let respuesta = await pedir(datos.limite);
    let devuelto = quitarMarcas(respuesta, conMarcas.etiquetas);

    // Una segunda oportunidad cuando se pasa de largo. Pedirlo otra vez con el
    // límite delante funciona a menudo, y una llamada de más es barata al lado
    // de tener que recortar el subtítulo a mano.
    if (datos.limite && seVaDeLargo(devuelto.texto, datos.limite)) {
        respuesta = await pedir(datos.limite);
        const segundo = quitarMarcas(respuesta, conMarcas.etiquetas);
        // Se queda la más corta de las dos, siempre que sirva.
        if (segundo.bien && segundo.texto.length < devuelto.texto.length) devuelto = segundo;
    }

    const revision = revisarTraduccion(datos.original, devuelto.texto, devuelto);

    return {
        traduccion: devuelto.texto,
        vale: revision.vale,
        motivo: revision.motivo,
        seVaDeLargo: seVaDeLargo(devuelto.texto, datos.limite),
    };
}

/**
 * Traduce un grupo de subtítulos en una sola petición.
 *
 * @param {Object} datos
 * @param {string[]} datos.originales
 * @param {Object} datos.config
 * @param {string} [datos.idiomaOrigen]
 * @param {string} [datos.idiomaDestino]
 * @param {Object} [datos.contexto]
 * @param {Array<{maxTotal: number, maxPorLinea: number}>} [datos.limites]
 * @param {{senal?: AbortSignal, fetchImpl?: Function}} [opciones]
 * @returns {Promise<Array<{traduccion: string, vale: boolean, motivo: string, seVaDeLargo: boolean}>>}
 *   Uno por cada original, en el mismo orden.
 */
export async function traducirLote(datos, opciones = {}) {
    // Con un modelo pequeño, de diez en diez no: se le pide una lista JSON con
    // diez traducciones en orden y devuelve cualquier cosa menos eso, así que
    // el lote entero se pierde. De uno en uno tarda más y sale algo.
    if (esPequeño(datos.config)) {
        const salida = [];
        for (let i = 0; i < datos.originales.length; i += 1) {
            salida.push(
                await traducirUno(
                    { ...datos, original: datos.originales[i], limite: datos.limites?.[i] },
                    opciones,
                ),
            );
        }
        return salida;
    }

    const conMarcas = datos.originales.map((texto) => ponerMarcas(texto));

    const respuesta = await conversar(
        datos.config,
        encargoDeTraducir({
            originales: conMarcas.map((m) => m.texto),
            idiomaOrigen: datos.idiomaOrigen,
            idiomaDestino: datos.idiomaDestino,
            contexto: datos.contexto,
            limites: datos.limites,
        }),
        { ...opciones, temperatura: 0.2 },
    );

    const lista = leerVariasTraducciones(respuesta, datos.originales.length);

    // Si la respuesta no se entiende, el lote entero se da por fallido en lugar
    // de intentar adivinar qué traducción va con qué subtítulo: colocar una
    // traducción en el subtítulo equivocado es el peor de los fallos posibles,
    // porque el archivo queda plausible y mal, y desde ahí todo va corrido.
    if (!lista) {
        return datos.originales.map(() => ({
            traduccion: '',
            vale: false,
            motivo: 'respuesta desordenada',
            seVaDeLargo: false,
        }));
    }

    return lista.map((texto, i) => {
        const devuelto = quitarMarcas(texto, conMarcas[i].etiquetas);
        const revision = revisarTraduccion(datos.originales[i], devuelto.texto, devuelto);
        return {
            traduccion: devuelto.texto,
            vale: revision.vale,
            motivo: revision.motivo,
            seVaDeLargo: seVaDeLargo(devuelto.texto, datos.limites?.[i]),
        };
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
            corto: esPequeño(datos.config),
        }),
        // Algo más de soltura que al traducir: aquí se busca una explicación
        // útil, no la misma frase palabra por palabra.
        { ...opciones, temperatura: 0.4 },
    );
}

export { LINEAS, REINTENTOS };
