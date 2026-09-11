/**
 * La alineación del texto en el editor.
 *
 * Un subtítulo se lee centrado en pantalla, y hay quien quiere verlo así
 * también mientras lo traduce, para juzgar el reparto de las dos líneas como se
 * va a ver. A la izquierda se compara mejor renglón a renglón con el original.
 * No hay una respuesta buena para todo el mundo, así que se elige.
 *
 * El original y la traducción se eligen por separado: hay quien quiere el
 * original a la izquierda, para leerlo como texto corrido, y la traducción
 * centrada, para verla como subtítulo.
 *
 * Se guarda en el navegador y no en el proyecto: es de cómo trabaja cada uno,
 * no del encargo. Un .subpanda que llevara la alineación de quien lo hizo se la
 * impondría a quien lo abra después.
 */
const CLAVES = {
    original: 'subpandatm_alinear_original',
    traduccion: 'subpandatm_alinear_traduccion',
};

/** Las tres, y nada más: lo que llegue de fuera se comprueba contra esta lista. */
const VALIDAS = ['left', 'center', 'right'];

const leer = (clave) => {
    try {
        return localStorage.getItem(clave);
    } catch {
        return null;
    }
};

const escribir = (clave, valor) => {
    try {
        localStorage.setItem(clave, valor);
    } catch {
        // Un navegador con el almacenamiento capado sigue pudiendo traducir; lo
        // único que pasa es que no recuerda la alineación de una vez a otra.
    }
};

/**
 * @param {'original'|'traduccion'} cual
 * @returns {'left'|'center'|'right'}
 */
export function alineacionDe(cual) {
    const guardada = leer(CLAVES[cual]);
    // Centrado de partida: un subtítulo se lee centrado en pantalla, así que
    // verlo centrado mientras se traduce es verlo como se va a ver. Quien
    // prefiera compararlo renglón a renglón con el original lo pone a la
    // izquierda en los ajustes y se queda puesto.
    return VALIDAS.includes(guardada) ? guardada : 'center';
}

/**
 * Guarda una alineación y la aplica al momento.
 *
 * @param {'original'|'traduccion'} cual
 * @param {string} valor
 */
export function guardarAlineacion(cual, valor) {
    if (!VALIDAS.includes(valor)) return;
    escribir(CLAVES[cual], valor);
    aplicarAlineacion();
}

/**
 * Deja la alineación puesta en la página.
 *
 * Va como dos atributos en el <html> y el resto lo hace el CSS: así vale para
 * los subtítulos que ya están pintados y para los que se pinten después, sin
 * tener que repintar la lista entera ni acordarse de aplicarlo en cada sitio
 * donde se crea una fila.
 */
export function aplicarAlineacion() {
    document.documentElement.dataset.alinearOriginal = alineacionDe('original');
    document.documentElement.dataset.alinearTraduccion = alineacionDe('traduccion');
}

/**
 * Engancha los dos grupos de botones del cuadro de ajustes.
 */
export function initAlineacion() {
    aplicarAlineacion();

    for (const [cual, id] of [
        ['original', 'alinearOriginal'],
        ['traduccion', 'alinearTraduccion'],
    ]) {
        const grupo = document.getElementById(id);
        if (!grupo) continue;

        const pintar = () => {
            const puesta = alineacionDe(cual);
            for (const boton of grupo.querySelectorAll('.ajustes-opcion')) {
                const suya = boton.dataset.alinear === puesta;
                boton.classList.toggle('activa', suya);
                boton.setAttribute('aria-pressed', String(suya));
            }
        };

        grupo.addEventListener('click', (evento) => {
            const boton = evento.target.closest('.ajustes-opcion');
            if (!boton) return;
            guardarAlineacion(cual, boton.dataset.alinear);
            pintar();
        });

        pintar();
    }
}
