/**
 * Sustituir trozos sueltos de un archivo sin tocar el resto.
 *
 * Es la pieza que permite cumplir la regla de la casa: abrir un archivo y
 * guardarlo sin traducir nada devuelve el mismo archivo, byte a byte. En lugar
 * de volver a escribir el archivo con lo que el programa ha entendido de él, se
 * apunta al leerlo en qué posición exacta empieza y acaba cada texto traducible
 * y, al guardar, se sustituyen solo esas posiciones.
 *
 * Todo lo demás —la sangría, las comillas, los comentarios, el orden, los
 * atributos que nadie sabía interpretar, si el archivo usaba saltos de línea de
 * Windows— vuelve intacto porque no se ha copiado: no se ha tocado.
 *
 * Un segmento sin traducir no genera ningún tramo, así que un archivo abierto y
 * guardado sin trabajar sale exactamente igual que entró.
 */

/**
 * Devuelve el texto con los tramos indicados sustituidos.
 *
 * @param {string} original Contenido con el que se abrió el archivo.
 * @param {Array<{inicio: number, fin: number, texto: string}>} tramos Trozos a
 *   sustituir, en cualquier orden. `fin` no se incluye, como en slice().
 * @returns {string}
 */
export function sustituirTramos(original, tramos) {
    const texto = String(original ?? '');
    const ordenados = [...(tramos || [])]
        .filter((t) => t && Number.isInteger(t.inicio) && Number.isInteger(t.fin))
        .sort((a, b) => a.inicio - b.inicio);

    let salida = '';
    let cursor = 0;

    for (const tramo of ordenados) {
        // Un tramo que empieza antes de donde va el cursor se pisaría con el
        // anterior. No debería pasar nunca; si pasa, se deja el original en pie
        // en lugar de escribir un archivo con la mitad de una etiqueta dentro de
        // la otra.
        if (tramo.inicio < cursor || tramo.fin < tramo.inicio) continue;
        salida += texto.slice(cursor, tramo.inicio) + String(tramo.texto ?? '');
        cursor = tramo.fin;
    }

    return salida + texto.slice(cursor);
}
