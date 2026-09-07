/**
 * Abrir y volver a cerrar los archivos que por dentro son una carpeta
 * comprimida: Word, Excel, PowerPoint, LibreOffice, los libros electrónicos y
 * los documentos de InDesign.
 *
 * Un .docx no es un formato en sí: es un zip con una veintena de archivos
 * dentro. Uno de ellos (word/document.xml) lleva el texto; los demás llevan los
 * estilos, las imágenes, las relaciones entre las partes y la configuración.
 * Traducir uno de estos archivos es, por tanto: descomprimir, cambiar el texto
 * de los archivos que lo tienen y volver a comprimir **dejando el resto tal y
 * como estaba**, byte a byte. Cualquier otra cosa da un archivo que Word abre
 * con un aviso de "contenido no legible" o que directamente no abre.
 *
 * Se usa fflate, que es una biblioteca pequeña que funciona igual en el
 * navegador y en las pruebas.
 */
import { unzipSync, zipSync } from 'fflate';

const decodificador = new TextDecoder('utf-8');
const codificador = new TextEncoder();

/**
 * Descomprime el archivo.
 *
 * @param {ArrayBuffer|Uint8Array} datos
 * @returns {Record<string, Uint8Array>} Cada archivo de dentro, por su ruta.
 */
export function abrirZip(datos) {
    const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
    return unzipSync(bytes);
}

/**
 * Vuelve a comprimir.
 *
 * Los archivos que no se han tocado se meten tal cual, sin volver a comprimir:
 * además de ser más rápido, evita que una versión distinta del compresor cambie
 * bytes que nadie ha pedido cambiar.
 *
 * @param {Record<string, Uint8Array>} archivos
 * @returns {ArrayBuffer}
 */
export function cerrarZip(archivos) {
    const comprimido = zipSync(archivos, { level: 6 });
    return comprimido.buffer.slice(
        comprimido.byteOffset,
        comprimido.byteOffset + comprimido.byteLength,
    );
}

/**
 * Lee como texto uno de los archivos de dentro.
 *
 * @param {Record<string, Uint8Array>} archivos
 * @param {string} ruta
 * @returns {string} Vacío si no está.
 */
export function leerTexto(archivos, ruta) {
    const contenido = archivos[ruta];
    return contenido ? decodificador.decode(contenido) : '';
}

/**
 * Escribe texto en uno de los archivos de dentro.
 *
 * @param {Record<string, Uint8Array>} archivos
 * @param {string} ruta
 * @param {string} texto
 */
export function escribirTexto(archivos, ruta, texto) {
    archivos[ruta] = codificador.encode(texto);
}

/**
 * Compara dos rutas contando los números como números.
 *
 * Ordenar letra a letra pone "slide10" antes que "slide2", y entonces los
 * segmentos salen en un orden que no es el del documento. Quien traduce lee la
 * lista de arriba abajo dando por hecho que es el orden en que se lee el
 * archivo, así que el orden importa.
 */
const comparaNatural = new Intl.Collator('es', { numeric: true }).compare;

/**
 * Lista las rutas de dentro que cumplen una condición.
 *
 * @param {Record<string, Uint8Array>} archivos
 * @param {(ruta: string) => boolean} condicion
 * @param {(ruta: string) => number} [prioridad] Para poner unos archivos antes
 *   que otros (las diapositivas antes que sus notas, por ejemplo).
 * @returns {string[]} En orden, para que el de los segmentos no dependa de en
 *   qué orden viniera el zip.
 */
export function rutasQueCumplen(archivos, condicion, prioridad) {
    return Object.keys(archivos)
        .filter(condicion)
        .sort((a, b) => {
            if (prioridad) {
                const diferencia = prioridad(a) - prioridad(b);
                if (diferencia !== 0) return diferencia;
            }
            return comparaNatural(a, b);
        });
}
