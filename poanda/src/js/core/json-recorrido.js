/**
 * Recorrer un JSON anotando dónde está cada texto.
 *
 * Lo comparten el lector de .json y el de .arb, que es un JSON con
 * convenciones propias de Flutter.
 *
 * Se hace a mano en lugar de con JSON.parse porque hace falta la posición
 * exacta de cada valor dentro del archivo: es lo que permite sustituir solo lo
 * traducido y devolver el resto —el orden de las claves, la sangría, las líneas
 * en blanco, lo que no sea texto— exactamente como vino. JSON.parse devuelve el
 * contenido, pero no de dónde salió, y reconstruir el archivo con
 * JSON.stringify lo reordena y lo reformatea entero.
 */

/**
 * Encuentra las cadenas de texto del JSON con su ruta y su posición.
 *
 * Entra en los objetos anidados, que es lo normal en los archivos de traducción
 * de las aplicaciones web:
 *
 *   { "menu": { "guardar": "Save" } }  →  clave "menu.guardar"
 *
 * Las listas también se recorren, y sus elementos se numeran ("dias.0").
 *
 * @param {string} texto Contenido del archivo.
 * @returns {Array<{clave: string, valor: string, inicio: number, fin: number}>}
 *   `inicio` y `fin` incluyen las comillas: al guardar se sustituye la cadena
 *   entera, ya escapada.
 */
export function cadenasDelJson(texto) {
    const cadena = String(texto ?? '');
    const encontradas = [];

    // Dónde estamos: la pila de claves (o de índices, dentro de una lista).
    const ruta = [];
    let claveEnCurso = null;
    let indiceDeLista = [];
    let dentroDeLista = [];

    for (let i = 0; i < cadena.length; i++) {
        const caracter = cadena[i];

        if (caracter === '{' || caracter === '[') {
            // Se entra en un objeto o en una lista: la clave que estuviera
            // esperando valor pasa a ser el nombre de este nivel.
            ruta.push(claveEnCurso);
            dentroDeLista.push(caracter === '[');
            indiceDeLista.push(0);
            claveEnCurso = null;
            continue;
        }

        if (caracter === '}' || caracter === ']') {
            ruta.pop();
            dentroDeLista.pop();
            indiceDeLista.pop();
            claveEnCurso = null;
            continue;
        }

        if (caracter === ',') {
            claveEnCurso = null;
            continue;
        }

        if (caracter !== '"') continue;

        const leida = leerCadena(cadena, i);
        if (!leida) break; // JSON mal formado: se deja de leer

        const enLista = dentroDeLista[dentroDeLista.length - 1];
        const esperaClave = !enLista && claveEnCurso === null;
        // Una cadena es clave si va seguida de dos puntos; si no, es un valor.
        const llevaDosPuntos = /^\s*:/.test(cadena.slice(leida.fin));

        if (esperaClave && llevaDosPuntos) {
            claveEnCurso = leida.valor;
        } else {
            const nombre = enLista
                ? String(indiceDeLista[indiceDeLista.length - 1]++)
                : claveEnCurso;

            encontradas.push({
                clave: [...ruta.slice(1), nombre].filter((p) => p !== null).join('.'),
                valor: leida.valor,
                inicio: i,
                fin: leida.fin,
            });
            claveEnCurso = null;
        }

        i = leida.fin - 1;
    }

    return encontradas;
}

/**
 * Lee una cadena JSON que empieza en la comilla de la posición dada.
 *
 * @param {string} texto
 * @param {number} inicio Posición de la comilla de apertura.
 * @returns {{valor: string, fin: number}|null} `fin` es la posición siguiente a
 *   la comilla de cierre.
 */
export function leerCadena(texto, inicio) {
    let crudo = '"';

    for (let i = inicio + 1; i < texto.length; i++) {
        const caracter = texto[i];
        crudo += caracter;

        if (caracter === '\\') {
            crudo += texto[i + 1] ?? '';
            i++;
            continue;
        }

        if (caracter === '"') {
            try {
                return { valor: JSON.parse(crudo), fin: i + 1 };
            } catch {
                return null;
            }
        }
    }

    return null;
}
