/**
 * Los colores, en un solo sitio.
 *
 * El navegador no escribe el color de una sola manera. Según por dónde se le
 * pida, el mismo amarillo sale como `<font color="#ffff00">` o como
 * `<span style="color: rgb(255, 255, 0)">`, y las dos formas acaban en el campo
 * de la traducción. Un archivo de subtítulos, en cambio, quiere una sola: un
 * `rgb(255, 255, 0)` dentro de un SRT es un color que casi ningún reproductor
 * entiende, y el subtítulo sale en blanco sin que nadie avise.
 *
 * Así que todo color pasa por aquí antes de escribirse, venga como venga.
 */

/**
 * Los colores con nombre que se usan en subtítulos.
 *
 * No están los ciento y pico que admite el CSS: están los que salen en un
 * subtítulo de verdad, que son los ocho de toda la vida —los del teletexto y
 * los de las subtítulos de televisión— más los grises, que aparecen de vez en
 * cuando en archivos hechos a mano.
 */
const CON_NOMBRE = {
    white: '#ffffff',
    silver: '#c0c0c0',
    gray: '#808080',
    grey: '#808080',
    black: '#000000',
    red: '#ff0000',
    lime: '#00ff00',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    cyan: '#00ffff',
    aqua: '#00ffff',
    magenta: '#ff00ff',
    fuchsia: '#ff00ff',
    orange: '#ffa500',
};

/**
 * Un color, sea como sea, a sus tres componentes.
 *
 * @param {string} valor `#rgb`, `#rrggbb`, `rgb(r, g, b)`, `rgba(r, g, b, a)` o
 *   un nombre de los de arriba.
 * @returns {{rojo: number, verde: number, azul: number}|null} `null` si no se
 *   entiende, que es la señal de "no toques esto".
 */
export function aComponentes(valor) {
    const cadena = String(valor ?? '').trim().toLowerCase();
    if (!cadena) return null;

    const porNombre = CON_NOMBRE[cadena];
    const conHex = (porNombre || cadena).match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (conHex) {
        const seis =
            conHex[1].length === 3
                ? conHex[1].split('').map((c) => c + c).join('')
                : conHex[1];
        const [rojo, verde, azul] = [0, 2, 4].map((i) => parseInt(seis.slice(i, i + 2), 16));
        return { rojo, verde, azul };
    }

    const conRgb = cadena.match(/^rgba?\(([^)]+)\)$/i);
    if (!conRgb) return null;

    // Se cogen los tres primeros: el cuarto es la transparencia, que un archivo
    // de subtítulos de texto no sabe representar.
    const numeros = conRgb[1]
        .split(/[,/\s]+/)
        .filter((n) => n !== '')
        .slice(0, 3)
        .map((n) => (n.trim().endsWith('%') ? (Number.parseFloat(n) * 255) / 100 : Number(n.trim())));

    if (numeros.length < 3 || !numeros.every((n) => Number.isFinite(n))) return null;
    const [rojo, verde, azul] = numeros;
    return { rojo, verde, azul };
}

/** Un número a dos cifras hexadecimales, sin salirse de 0-255. */
function dos(n) {
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/**
 * El color tal y como debe quedar escrito en un archivo de subtítulos.
 *
 * La norma es no tocar lo que ya funciona, la misma que con los tiempos: un
 * archivo que dice `red` no se reescribe a `#ff0000` porque sí. Un nombre de
 * los de siempre y un `#rrggbb` los entiende cualquier reproductor, así que se
 * quedan como vinieron. Lo que se cambia es lo que el navegador escribe y un
 * reproductor no entiende: `rgb(0, 255, 255)`, `#0fc`, `rgba(...)`.
 *
 * @param {string} valor
 * @returns {string} El color listo para el archivo. Si no se entiende, vuelve
 *   tal cual vino: es preferible dejar algo raro que alguien puso a propósito
 *   antes que borrárselo.
 */
export function comoLoEntiendeUnArchivo(valor) {
    const cadena = String(valor ?? '').trim();
    if (/^#[0-9a-f]{6}$/i.test(cadena)) return cadena;
    if (Object.prototype.hasOwnProperty.call(CON_NOMBRE, cadena.toLowerCase())) return cadena;
    return aHex(cadena) || cadena;
}

/**
 * Un color, sea como sea, a `#rrggbb` en minúsculas.
 *
 * @param {string} valor
 * @returns {string} El color en hexadecimal, o cadena vacía si no se entiende.
 *   Vacío quiere decir "déjalo como estaba": es preferible escribir en el
 *   archivo algo raro que el usuario puso a propósito que borrarlo.
 */
export function aHex(valor) {
    const partes = aComponentes(valor);
    if (!partes) return '';
    return `#${dos(partes.rojo)}${dos(partes.verde)}${dos(partes.azul)}`;
}
