/**
 * Archivos .mqxlz, el bilingüe comprimido de memoQ.
 *
 * Es un zip con el .mqxliff dentro (y, según cómo se haya exportado, el
 * esqueleto del documento original). Se descomprime, se traduce el XLIFF con el
 * lector de siempre y se vuelve a comprimir dejando todo lo demás como estaba,
 * que es lo que hace que el archivo se pueda devolver a memoQ.
 */
import { parseXliffContent, reconstructXliff } from './xliff.js';
import { abrirZip, cerrarZip, escribirTexto, leerTexto, rutasQueCumplen } from './zip.js';

/** El bilingüe de dentro. Se busca por extensión y no por nombre porque cambia. */
const ES_EL_BILINGUE = (ruta) => /\.(mqxliff|xliff|xlf)$/i.test(ruta);

/**
 * Encuentra la ruta del bilingüe dentro del zip.
 *
 * @param {Record<string, Uint8Array>} archivos
 * @returns {string|null}
 */
function rutaDelBilingue(archivos) {
    return rutasQueCumplen(archivos, ES_EL_BILINGUE)[0] || null;
}

/**
 * Lee un .mqxlz.
 *
 * @param {ArrayBuffer} datos
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseMqxlzContent(datos) {
    const archivos = abrirZip(datos);
    const ruta = rutaDelBilingue(archivos);
    if (!ruta) throw new Error('El .mqxlz no lleva dentro ningún archivo bilingüe.');

    return parseXliffContent(leerTexto(archivos, ruta)).map((entrada) => ({
        ...entrada,
        archivoInterno: ruta,
    }));
}

/**
 * Vuelve a montar el .mqxlz con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {ArrayBuffer} original
 * @returns {ArrayBuffer}
 */
export function reconstructMqxlz(entradas, original) {
    const archivos = abrirZip(original);
    const ruta = rutaDelBilingue(archivos);
    if (!ruta) return cerrarZip(archivos);

    escribirTexto(archivos, ruta, reconstructXliff(entradas, leerTexto(archivos, ruta)));
    return cerrarZip(archivos);
}
