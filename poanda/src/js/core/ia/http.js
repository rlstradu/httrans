/**
 * Las llamadas a los servicios de IA.
 *
 * Se llama al servicio directamente desde el navegador, con la clave de quien
 * usa Poanda. No hay servidor propio por el medio, y es a propósito: montar uno
 * significaría que los textos de tus clientes pasan por una máquina nuestra, y
 * eso es exactamente lo que Poanda no hace. El precio de esa decisión es que la
 * clave vive en el navegador (ver ajustes.js) y que dependemos de que cada
 * servicio permita que se le llame desde una página web.
 *
 * `fetch` se puede sustituir al llamar. Es lo que permite probar todo esto sin
 * red y sin gastar una sola llamada de verdad.
 */

/** Cuánto se espera a una respuesta antes de darla por perdida. */
const ESPERA_NORMAL = 60_000;

/**
 * Un fallo con nombre, para poder decidir qué hacer con él.
 *
 * El código importa: `clave` y `saldo` no se reintentan (reintentar con una
 * clave mal escrita es gastar el tiempo de quien espera), `limite` se reintenta
 * después de esperar, y `red` puede ser de verdad un problema de red o el
 * navegador negándose a llamar a ese servicio, que desde JavaScript no se
 * distinguen.
 */
export class ErrorDeIA extends Error {
    /**
     * @param {string} codigo 'clave' | 'saldo' | 'limite' | 'red' | 'modelo' | 'servicio'
     * @param {string} mensaje
     * @param {{reintentable?: boolean, esperarMs?: number}} [datos]
     */
    constructor(codigo, mensaje, datos = {}) {
        super(mensaje);
        this.name = 'ErrorDeIA';
        this.codigo = codigo;
        this.reintentable = datos.reintentable ?? ['limite', 'red', 'servicio'].includes(codigo);
        this.esperarMs = datos.esperarMs || 0;
    }
}

/**
 * Traduce el código de estado HTTP a uno de nuestros códigos.
 *
 * @param {number} estado
 * @param {string} cuerpo
 * @returns {string}
 */
function codigoDelEstado(estado, cuerpo) {
    if (estado === 401 || estado === 403) return 'clave';
    if (estado === 402) return 'saldo';
    if (estado === 429) return 'limite';
    if (estado === 404 && /model/i.test(cuerpo)) return 'modelo';
    if (estado >= 500) return 'servicio';
    if (/quota|billing|insufficient/i.test(cuerpo)) return 'saldo';
    return 'servicio';
}

/**
 * Lee la cabecera que dice cuánto hay que esperar tras un "vas muy deprisa".
 *
 * @param {Headers} cabeceras
 * @returns {number} Milisegundos.
 */
function esperaPedida(cabeceras) {
    const valor = cabeceras?.get?.('retry-after');
    if (!valor) return 0;

    const segundos = Number(valor);
    if (Number.isFinite(segundos)) return Math.max(0, segundos * 1000);

    const fecha = Date.parse(valor);
    return Number.isFinite(fecha) ? Math.max(0, fecha - Date.now()) : 0;
}

/**
 * Hace una petición y devuelve la respuesta ya interpretada como JSON.
 *
 * @param {string} url
 * @param {Object} opciones
 * @param {Object} [opciones.cuerpo] Lo que se manda, sin convertir a texto.
 * @param {Object} [opciones.cabeceras]
 * @param {string} [opciones.metodo]
 * @param {AbortSignal} [opciones.senal]
 * @param {Function} [opciones.fetchImpl] Para las pruebas.
 * @returns {Promise<Object>}
 */
export async function pedirJson(url, opciones = {}) {
    const {
        cuerpo,
        cabeceras = {},
        metodo = cuerpo ? 'POST' : 'GET',
        senal,
        fetchImpl = globalThis.fetch,
    } = opciones;

    let respuesta;
    try {
        respuesta = await fetchImpl(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabeceras },
            body: cuerpo ? JSON.stringify(cuerpo) : undefined,
            signal: senal,
        });
    } catch (error) {
        if (error?.name === 'AbortError') throw error;
        // Un fallo de red y un navegador que se niega a llamar a ese servicio
        // dan el mismo error, así que el mensaje tiene que servir para los dos.
        throw new ErrorDeIA(
            'red',
            'No se ha podido contactar con el servicio. Comprueba la conexión y, si es una IA local, que esté en marcha y que acepte llamadas desde esta página.',
        );
    }

    const texto = await respuesta.text();

    if (!respuesta.ok) {
        const codigo = codigoDelEstado(respuesta.status, texto);
        throw new ErrorDeIA(codigo, mensajeDelServicio(texto) || `Error ${respuesta.status}`, {
            esperarMs: esperaPedida(respuesta.headers),
        });
    }

    try {
        return texto ? JSON.parse(texto) : {};
    } catch {
        throw new ErrorDeIA('servicio', 'El servicio ha respondido algo que no se entiende.');
    }
}

/**
 * Saca el mensaje de error del cuerpo de la respuesta, que cada servicio pone
 * en un sitio distinto.
 *
 * @param {string} texto
 * @returns {string}
 */
function mensajeDelServicio(texto) {
    try {
        const datos = JSON.parse(texto);
        return datos?.error?.message || datos?.error || datos?.message || '';
    } catch {
        return String(texto || '').slice(0, 300);
    }
}

/**
 * Una espera que se puede cancelar.
 *
 * @param {number} ms
 * @param {AbortSignal} [senal]
 * @returns {Promise<void>}
 */
export function esperar(ms, senal) {
    return new Promise((resolver, rechazar) => {
        const reloj = setTimeout(resolver, ms);
        senal?.addEventListener('abort', () => {
            clearTimeout(reloj);
            rechazar(new DOMException('Cancelado', 'AbortError'));
        });
    });
}

export { ESPERA_NORMAL };
