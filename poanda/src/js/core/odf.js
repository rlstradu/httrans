/**
 * LibreOffice y OpenOffice: textos (.odt), hojas de cálculo (.ods) y
 * presentaciones (.odp).
 *
 * Igual que los de Microsoft, son un zip; el texto vive en content.xml (y algo
 * en styles.xml, que es donde van las cabeceras y los pies de página). A
 * diferencia de Word, aquí el párrafo sí guarda su texto de una pieza, con el
 * formato marcado por dentro con <text:span>. Eso permite hacer lo correcto: un
 * segmento es un párrafo, y el formato de dentro se queda dentro del segmento
 * como una etiqueta más, que quien traduce puede colocar donde le corresponda
 * en su idioma.
 *
 * En una hoja de cálculo cada celda con texto es un párrafo, así que sale un
 * segmento por celda sin tener que hacer nada especial. En una presentación,
 * cada cuadro de texto de cada diapositiva.
 *
 * Todo lo demás vuelve intacto: estilos, imágenes, fórmulas y configuración.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';
import { escaparDejandoEtiquetas } from './xml.js';
import { trozosDeElementos } from './xml-bloques.js';
import { abrirZip, cerrarZip, escribirTexto, leerTexto } from './zip.js';

/** Los dos archivos de dentro que llevan texto de quien escribió. */
const CON_TEXTO = ['content.xml', 'styles.xml'];

/** Párrafos y títulos. En ODF el título de un apartado es <text:h>. */
const TRADUCIBLES = ['p', 'h'];

/**
 * Lee un documento de LibreOffice.
 *
 * @param {ArrayBuffer} datos
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseOdfContent(datos) {
    const archivos = abrirZip(datos);
    const entradas = [];

    for (const ruta of CON_TEXTO) {
        if (!archivos[ruta]) continue;
        const xml = leerTexto(archivos, ruta);

        for (const trozo of trozosDeElementos(xml, { traducibles: TRADUCIBLES })) {
            entradas.push({
                msgid: trozo.original,
                msgstr: '',
                comments: [],
                isHeader: false,
                archivoInterno: ruta,
                valorInicio: trozo.inicio,
                valorFin: trozo.fin,
                sentenceSegments: [
                    {
                        original: trozo.original,
                        translation: '',
                        wordCountOriginal: countWords(trozo.original),
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
export function reconstructOdf(entradas, original) {
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
            texto: escaparDejandoEtiquetas(traduccion),
        });
    }

    for (const [ruta, tramos] of porArchivo) {
        escribirTexto(archivos, ruta, sustituirTramos(leerTexto(archivos, ruta), tramos));
    }

    return cerrarZip(archivos);
}
