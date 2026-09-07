/**
 * Documentos de InDesign (.idml), los de maquetación.
 *
 * También son un zip. El texto vive en la carpeta Stories: un archivo por
 * "historia", que es cada hilo de texto del documento (el cuerpo de un artículo,
 * un pie de foto, un titular). Dentro, el texto va en elementos <Content>,
 * repartidos igual que en Word cada vez que cambia el formato.
 *
 * Un segmento es aquí un <Content>. No se juntan los de un mismo párrafo a
 * propósito: en maquetación, dos <Content> seguidos suelen ser cosas
 * tipográficamente distintas (una letra capital, una palabra en versalitas, un
 * cambio de fuente), y juntarlos para separarlos luego es la forma más fácil de
 * estropear una maqueta que alguien ha ajustado a mano.
 *
 * Todo lo demás vuelve intacto: las páginas, los estilos, los marcos, las
 * imágenes vinculadas y el orden de las historias.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';
import { desescaparXml, escaparXml } from './xml.js';
import { buscarElementos } from './xml.js';
import { abrirZip, cerrarZip, escribirTexto, leerTexto, rutasQueCumplen } from './zip.js';

/** Los archivos con el texto del documento. */
const ES_HISTORIA = (ruta) => /^Stories\/.*\.xml$/i.test(ruta);

/**
 * Lee un documento de InDesign.
 *
 * @param {ArrayBuffer} datos
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseIdmlContent(datos) {
    const archivos = abrirZip(datos);
    const entradas = [];

    for (const ruta of rutasQueCumplen(archivos, ES_HISTORIA)) {
        const xml = leerTexto(archivos, ruta);

        for (const contenido of buscarElementos(xml, 'Content')) {
            const original = desescaparXml(contenido.contenido);
            if (!original.trim()) continue;

            entradas.push({
                msgid: original,
                msgstr: '',
                msgctxt: ruta.split('/').pop(),
                comments: [],
                isHeader: false,
                archivoInterno: ruta,
                valorInicio: contenido.contenidoInicio,
                valorFin: contenido.contenidoFin,
                sentenceSegments: [
                    {
                        original,
                        translation: '',
                        wordCountOriginal: countWords(original),
                        wordCountTranslation: 0,
                        isTranslated: false,
                    },
                ],
            });
        }
    }

    return entradas;
}

/**
 * Vuelve a montar el documento con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {ArrayBuffer} original
 * @returns {ArrayBuffer}
 */
export function reconstructIdml(entradas, original) {
    const archivos = abrirZip(original);
    const porArchivo = new Map();

    for (const entrada of entradas || []) {
        if (!entrada.archivoInterno || entrada.valorInicio === undefined) continue;
        const traduccion = (entrada.sentenceSegments || [])
            .map((s) => s.translation || '')
            .join('');
        if (!traduccion) continue;

        if (!porArchivo.has(entrada.archivoInterno)) porArchivo.set(entrada.archivoInterno, []);
        porArchivo.get(entrada.archivoInterno).push({
            inicio: entrada.valorInicio,
            fin: entrada.valorFin,
            texto: escaparXml(traduccion),
        });
    }

    for (const [ruta, tramos] of porArchivo) {
        escribirTexto(archivos, ruta, sustituirTramos(leerTexto(archivos, ruta), tramos));
    }

    return cerrarZip(archivos);
}
