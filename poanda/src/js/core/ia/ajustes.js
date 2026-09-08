/**
 * Dónde se guarda la configuración de la IA, y sobre todo la clave.
 *
 * LA CLAVE
 *
 * Se guarda en el navegador, sin cifrar. No hay alternativa honesta en una
 * herramienta que funciona sin servidor: cifrarla exigiría guardar en el mismo
 * navegador la llave del cifrado, lo que no protege de nada y solo da una falsa
 * sensación de seguridad.
 *
 * Lo que sí se puede hacer, y se hace:
 *
 * - Por defecto se guarda solo para esta sesión (sessionStorage): al cerrar la
 *   pestaña desaparece.
 * - Solo se queda en el ordenador si se marca "recordar" a propósito.
 * - Cada servicio tiene su propia clave guardada, para que la de uno no se use
 *   nunca con otro.
 * - Nunca sale en un proyecto exportado ni en una copia de seguridad. Eso no es
 *   un detalle: un .poanda se manda por correo, y una clave dentro sería una
 *   factura ajena esperando a pasar.
 */

/** Prefijo de todo lo que guarda este módulo. */
const P = 'poanda_ia_';

const CLAVES = {
    proveedor: `${P}proveedor`,
    recordar: `${P}recordar_clave`,
    modelo: (id) => `${P}modelo_${id}`,
    apiKey: (id) => `${P}clave_${id}`,
    baseUrl: (id) => `${P}url_${id}`,
    instrucciones: `${P}instrucciones`,
    motorPretraducir: `${P}motor_pretraducir`,
};

/**
 * Los almacenes del navegador, envueltos para que un navegador que los tenga
 * bloqueados no tire la herramienta abajo: sin poder guardar, Poanda sigue
 * funcionando y lo único que pasa es que hay que volver a escribir la clave.
 */
const almacen = (cual) => {
    try {
        return globalThis[cual] || null;
    } catch {
        return null;
    }
};

const leer = (cual, clave) => {
    try {
        return almacen(cual)?.getItem(clave) ?? '';
    } catch {
        return '';
    }
};

const escribir = (cual, clave, valor) => {
    try {
        if (valor) almacen(cual)?.setItem(clave, valor);
        else almacen(cual)?.removeItem(clave);
    } catch {
        // Sin almacenamiento no se guarda nada; no es motivo para romper nada.
    }
};

/**
 * Rescata la clave de Gemini que guardaba la versión anterior.
 *
 * Antes solo se podía usar Gemini y su clave vivía en otro sitio. Quien la
 * tuviera puesta no debería tener que ir a buscarla otra vez por un cambio que
 * no ha pedido, así que se recoge una vez y se guarda donde toca ahora. Como
 * antes se guardaba para siempre, se respeta eso y se marca "recordar".
 */
function migrarClaveAntigua() {
    const antigua = leer('localStorage', 'poanda_gemini_key');
    if (!antigua) return;

    escribir('localStorage', CLAVES.recordar, '1');
    escribir('localStorage', CLAVES.apiKey('gemini'), antigua);
    escribir('sessionStorage', CLAVES.apiKey('gemini'), antigua);
    escribir('localStorage', 'poanda_gemini_key', '');
}

/** @returns {boolean} Si la clave se guarda entre sesiones. */
export function seRecuerdaLaClave() {
    return leer('localStorage', CLAVES.recordar) === '1';
}

/**
 * @param {boolean} recordar
 */
export function recordarLaClave(recordar) {
    escribir('localStorage', CLAVES.recordar, recordar ? '1' : '');

    if (!recordar) {
        // Al dejar de recordar hay que borrar lo ya guardado de todos los
        // servicios, no solo del que esté elegido ahora.
        for (const id of ['gemini', 'openai', 'anthropic', 'compatible']) {
            escribir('localStorage', CLAVES.apiKey(id), '');
        }
    }
}

/**
 * @param {string} proveedorId
 * @returns {string}
 */
export function leerClave(proveedorId) {
    return (
        leer('sessionStorage', CLAVES.apiKey(proveedorId)) ||
        leer('localStorage', CLAVES.apiKey(proveedorId))
    );
}

/**
 * @param {string} proveedorId
 * @param {string} clave
 */
export function guardarClave(proveedorId, clave) {
    const limpia = String(clave || '').trim();
    escribir('sessionStorage', CLAVES.apiKey(proveedorId), limpia);
    escribir('localStorage', CLAVES.apiKey(proveedorId), seRecuerdaLaClave() ? limpia : '');
}

/**
 * Devuelve la configuración completa, lista para llamar al servicio.
 *
 * @param {Object} [porDefecto] Lo que traiga cada proveedor.
 * @returns {{proveedor: string, modelo: string, baseUrl: string, clave: string, instrucciones: string}}
 */
export function leerConfiguracion(porDefecto = {}) {
    migrarClaveAntigua();

    const proveedor = leer('localStorage', CLAVES.proveedor) || porDefecto.proveedor || 'gemini';

    return {
        proveedor,
        modelo: leer('localStorage', CLAVES.modelo(proveedor)) || porDefecto.modelo || '',
        baseUrl: leer('localStorage', CLAVES.baseUrl(proveedor)) || porDefecto.baseUrl || '',
        clave: leerClave(proveedor),
        instrucciones: leer('localStorage', CLAVES.instrucciones),
    };
}

/**
 * @param {Object} config
 */
export function guardarConfiguracion(config) {
    const proveedor = config.proveedor || 'gemini';
    escribir('localStorage', CLAVES.proveedor, proveedor);
    escribir('localStorage', CLAVES.modelo(proveedor), config.modelo || '');
    escribir('localStorage', CLAVES.baseUrl(proveedor), config.baseUrl || '');
    if (config.instrucciones !== undefined) {
        escribir('localStorage', CLAVES.instrucciones, config.instrucciones || '');
    }
    if (config.clave !== undefined) guardarClave(proveedor, config.clave);
}

/**
 * ¿Hay un servicio de IA con el que se pueda llamar de verdad?
 *
 * No comprueba que el servicio responda —eso solo lo sabe el servicio—, sino
 * que no falte nada de lo que hace falta para llamarlo: servicio elegido,
 * clave si la pide, y modelo.
 *
 * Esta comprobación estaba escrita dos veces, una en el panel de ajustes y
 * otra en el asistente, y ahora hace falta una tercera para pretraducir. Tres
 * copias de la misma regla es una regla que va a dejar de ser la misma, así
 * que vive aquí, que es donde está la configuración que mira.
 *
 * @param {{proveedorPorId: function}} proveedores Cómo buscar un proveedor por
 *   su id. Se pasa desde fuera para que este módulo siga sin depender de la
 *   lista de servicios, que es la que cambia cada vez que sale uno nuevo.
 * @returns {boolean}
 */
export function hayServicioConectado({ proveedorPorId }) {
    const config = leerConfiguracion();
    const proveedor = proveedorPorId(config.proveedor);
    if (!proveedor) return false;
    if (proveedor.necesitaClave && !config.clave) return false;
    return Boolean(config.modelo || proveedor.modeloPorDefecto);
}

/** @returns {string} 'rapido' o 'contexto'. */
export function leerMotorDePretraducir() {
    return leer('localStorage', CLAVES.motorPretraducir) || 'rapido';
}

/** @param {string} motor */
export function guardarMotorDePretraducir(motor) {
    escribir('localStorage', CLAVES.motorPretraducir, motor);
}

export { CLAVES };
