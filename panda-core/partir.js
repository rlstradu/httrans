/**
 * Partir un subtítulo en dos sin romper lo que lleva dentro.
 *
 * Partir un subtítulo es de las cosas que más se hacen al ajustar, y el texto
 * casi nunca es texto pelado: lleva una cursiva, un `<span>` con el estilo de la
 * plataforma, un color. Cortar por un número de caracteres a secas parte la
 * etiqueta por la mitad:
 *
 *     Hello <span tts:fontStyle="italic">world</span>
 *                            ↑ corte aquí
 *     →  "Hello <span tts:fon"  +  "tStyle=\"italic\">world</span>"
 *
 * Y eso no es un subtítulo con una etiqueta rara: es un archivo que no abre.
 *
 * Aquí se cuenta por **caracteres que se ven** —las etiquetas no cuentan, como
 * en el resto de la herramienta— y al llegar al corte se cierran las etiquetas
 * que estuvieran abiertas y se vuelven a abrir en el segundo trozo, que es lo
 * que haría cualquier herramienta TAO:
 *
 *     →  "Hello <span tts:fontStyle=\"italic\">wor</span>"
 *     +  "<span tts:fontStyle=\"italic\">ld</span>"
 *
 * Y se corta por donde se corta un subtítulo: por un espacio o por un salto de
 * línea. Cortar una palabra por la mitad se ve tan mal como cortar una etiqueta,
 * solo que además se ve.
 */

/** Una etiqueta: `<span …>`, `</span>`, `<br/>`. */
const ETIQUETA = /^<\/?[a-z][\w.-]*(?::[\w.-]+)?(?:\s[^<>]*)?\/?>/i;

/** Una entidad: `&amp;`, `&#39;`. Cuenta como un carácter, que es lo que se ve. */
const ENTIDAD = /^&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i;

/**
 * Cuántos caracteres se ven en un texto con etiquetas.
 *
 * @param {string} texto
 * @returns {number}
 */
export function cuantoSeVe(texto) {
    return recorrer(String(texto ?? '')).length;
}

/**
 * Parte un texto en dos por el carácter visible que se le diga.
 *
 * @param {string} texto Texto con sus etiquetas.
 * @param {number} corte Cuántos caracteres visibles van en el primer trozo.
 * @param {{porPalabras?: boolean}} [opciones] Si se busca el espacio más cercano
 *   al corte, que es lo que se quiere al partir un subtítulo.
 * @returns {[string, string]}
 */
export function partirEnDos(texto, corte, { porPalabras = true } = {}) {
    const cadena = String(texto ?? '');
    const pasos = recorrer(cadena);

    const donde = Math.max(0, Math.min(Math.round(corte), pasos.length));
    const enPalabra = porPalabras ? buscarUnHueco(pasos, donde) : donde;

    // Dónde cae ese carácter dentro de la cadena, y qué etiquetas hay abiertas
    // justo ahí.
    const paso = pasos[enPalabra];
    const acaba = paso ? paso.donde : cadena.length;
    const abiertas = paso ? paso.abiertas : [];

    // El espacio por el que se corta no va a ninguno de los dos trozos: es la
    // costura. Dejarlo delante del segundo deja un subtítulo que empieza por un
    // espacio dentro de la cursiva, que ni se ve ni se quita a mano. Se salta
    // por su largo en la cadena y no hasta el carácter siguiente, que en medio
    // puede haber una etiqueta que abre y que el segundo trozo necesita.
    const separador = paso && /\s/.test(paso.caracter);
    const empieza = separador ? paso.donde + paso.largo : acaba;

    const cierres = abiertas
        .map((etiqueta) => `</${nombreDe(etiqueta)}>`)
        .reverse()
        .join('');

    const primero = cadena.slice(0, acaba) + cierres;
    const segundo = abiertas.join('') + cadena.slice(empieza);

    return [limpiar(primero), limpiar(segundo)];
}

/**
 * Recorre el texto y devuelve, por cada carácter que se ve, dónde está y qué
 * etiquetas hay abiertas en ese punto.
 *
 * @param {string} texto
 * @returns {Array<{caracter: string, donde: number, largo: number,
 *   abiertas: string[]}>}
 */
function recorrer(texto) {
    const pasos = [];
    const abiertas = [];
    let i = 0;

    while (i < texto.length) {
        const resto = texto.slice(i);
        const etiqueta = resto.match(ETIQUETA);

        if (etiqueta) {
            const entera = etiqueta[0];

            if (/^<\//.test(entera)) {
                // Se cierra la última que se abriera con ese nombre. Buscarla en
                // lugar de sacar la de arriba aguanta el marcado mal anidado que
                // sale de un campo de edición.
                const nombre = nombreDe(entera);
                for (let j = abiertas.length - 1; j >= 0; j -= 1) {
                    if (nombreDe(abiertas[j]) === nombre) {
                        abiertas.splice(j, 1);
                        break;
                    }
                }
            } else if (!/\/>$/.test(entera) && !/^<br\b/i.test(entera)) {
                abiertas.push(entera);
            }

            // El <br/> es un salto de línea: se ve, y además es un sitio
            // estupendo por donde partir.
            if (/^<br\b/i.test(entera)) {
                pasos.push({
                    caracter: '\n',
                    donde: i,
                    largo: entera.length,
                    abiertas: [...abiertas],
                });
            }

            i += entera.length;
            continue;
        }

        const entidad = resto.match(ENTIDAD);
        const largo = entidad ? entidad[0].length : 1;
        pasos.push({
            // Una entidad se cuenta como un carácter, pero no como un espacio:
            // "&amp;" es un "&" y por ahí no se parte un subtítulo.
            caracter: entidad ? '&' : texto[i],
            donde: i,
            largo,
            abiertas: [...abiertas],
        });
        i += largo;
    }

    return pasos;
}

/**
 * Busca el espacio o el salto de línea más cercano al corte.
 *
 * Un salto de línea manda sobre un espacio: si el subtítulo ya venía partido en
 * dos líneas, ahí es justo por donde hay que partirlo.
 *
 * @param {Array} pasos
 * @param {number} donde
 * @returns {number}
 */
function buscarUnHueco(pasos, donde) {
    if (donde <= 0 || donde >= pasos.length) return donde;

    const esSalto = (i) => pasos[i]?.caracter === '\n';
    const esHueco = (i) => /\s/.test(pasos[i]?.caracter ?? '');

    for (const mira of [esSalto, esHueco]) {
        for (let salto = 0; salto < pasos.length; salto += 1) {
            if (donde - salto >= 0 && mira(donde - salto)) return donde - salto;
            if (donde + salto < pasos.length && mira(donde + salto)) return donde + salto;
        }
    }

    return donde;
}

/** El nombre de una etiqueta, sin el prefijo de espacio de nombres. */
function nombreDe(etiqueta) {
    const nombre = String(etiqueta).match(/^<\/?([\w.-]+(?::[\w.-]+)?)/);
    return nombre ? nombre[1].toLowerCase() : '';
}

/**
 * Quita los restos de partir: espacios sobrantes y etiquetas que se han quedado
 * vacías porque todo su contenido se fue al otro trozo.
 */
function limpiar(texto) {
    let salida = texto;
    let antes;

    do {
        antes = salida;
        salida = salida.replace(/<([a-z][\w.-]*(?::[\w.-]+)?)(?:\s[^<>]*)?>\s*<\/\1\s*>/gi, '');
    } while (salida !== antes);

    return salida.replace(/^[ \t]*\n?/, '').replace(/\n?[ \t]*$/, '').trim();
}
