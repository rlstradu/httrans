/**
 * Sacar el texto traducible de un XML por bloques.
 *
 * Lo comparten los formatos que guardan el texto dentro de elementos con
 * nombre: DITA, los documentos de LibreOffice, las páginas de un libro
 * electrónico y las historias de InDesign. En todos ellos la idea es la misma:
 *
 * - Hay una lista de elementos que llevan texto para quien lee (el párrafo, el
 *   título, el punto de una lista) y son los que se traducen.
 * - Hay otra lista de elementos intocables (el código, sobre todo) que se dejan
 *   como están aunque lleven texto dentro.
 * - Un elemento traducible dentro de otro no se cuenta aparte: se traduce el
 *   bloque entero, con el de dentro incluido como si fuera una etiqueta. Es la
 *   diferencia entre traducir "Pulsa <b>Guardar</b> ahora" y traducir "Pulsa",
 *   "Guardar" y "ahora" por separado, que es como salen las traducciones raras.
 *
 * De cada bloque se anota dónde empieza y acaba su contenido, para poder
 * sustituir solo eso y devolver el archivo intacto.
 */
import { buscarElementos, desescaparXml } from './xml.js';

/**
 * @param {string} texto Contenido del archivo XML.
 * @param {{traducibles: string[], intocables?: string[]}} reglas
 * @returns {Array<{inicio: number, fin: number, original: string, etiqueta: string}>}
 */
export function trozosDeElementos(texto, { traducibles, intocables = [] }) {
    const cadena = String(texto ?? '');

    const prohibidos = intocables.flatMap((nombre) => buscarElementos(cadena, nombre));
    const dentroDeIntocable = (posicion) =>
        prohibidos.some((zona) => posicion > zona.inicio && posicion < zona.fin);

    const encontrados = traducibles
        .flatMap((nombre) =>
            buscarElementos(cadena, nombre).map((elemento) => ({ ...elemento, nombre })),
        )
        .sort((a, b) => a.inicio - b.inicio);

    const trozos = [];

    for (const elemento of encontrados) {
        if (dentroDeIntocable(elemento.inicio)) continue;

        const yaContado = trozos.some(
            (otro) => elemento.inicio > otro.inicio && elemento.fin <= otro.fin,
        );
        if (yaContado) continue;

        const original = desescaparXml(elemento.contenido).trim();
        if (!original) continue;

        trozos.push({
            inicio: elemento.contenidoInicio,
            fin: elemento.contenidoFin,
            original,
            etiqueta: elemento.nombre,
        });
    }

    return trozos;
}
