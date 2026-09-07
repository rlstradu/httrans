/**
 * Libros electrónicos (.epub).
 *
 * Un epub es un zip con una página web por capítulo. Se traducen los bloques de
 * texto de cada página —párrafos, títulos, puntos de lista, celdas, pies de
 * imagen— y también el título del libro y los datos de la portada, que están en
 * el archivo de metadatos y son lo que se ve en la biblioteca del lector.
 *
 * No se toca nada más: ni los estilos, ni las imágenes, ni el índice, ni el
 * orden de los capítulos. Las etiquetas de dentro de un párrafo (la cursiva de
 * un título de libro, un enlace a una nota) se quedan dentro del segmento, para
 * que quien traduce las coloque donde toque en su idioma.
 *
 * Los capítulos salen en el orden en que están dentro del archivo, que es el
 * orden alfabético de sus nombres. En la inmensa mayoría de los epub eso
 * coincide con el orden de lectura, porque los generadores numeran los archivos.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';
import { escaparDejandoEtiquetas } from './xml.js';
import { trozosDeElementos } from './xml-bloques.js';
import { abrirZip, cerrarZip, escribirTexto, leerTexto, rutasQueCumplen } from './zip.js';

/** Las páginas del libro. */
const ES_CAPITULO = (ruta) => /\.(x?html|htm)$/i.test(ruta);

/** El archivo de datos del libro: título, autor, descripción. */
const ES_METADATOS = (ruta) => /\.opf$/i.test(ruta);

/** Bloques de texto de una página. */
const TRADUCIBLES = [
    'title',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'li',
    'td',
    'th',
    'caption',
    'figcaption',
    'blockquote',
    'dt',
    'dd',
];

/** Lo que no es texto para quien lee. */
const INTOCABLES = ['script', 'style', 'code', 'pre'];

/** Datos del libro que sí se traducen. */
const DATOS_TRADUCIBLES = ['title', 'description', 'subject'];

/**
 * Lee un libro electrónico.
 *
 * @param {ArrayBuffer} datos
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseEpubContent(datos) {
    const archivos = abrirZip(datos);
    const entradas = [];

    const anotar = (ruta, trozo) => {
        entradas.push({
            msgid: trozo.original,
            msgstr: '',
            // El contexto dice de qué capítulo sale, que es lo que ayuda a
            // situarse en un libro de trescientas páginas.
            msgctxt: ruta.split('/').pop(),
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
    };

    for (const ruta of rutasQueCumplen(archivos, ES_METADATOS)) {
        const xml = leerTexto(archivos, ruta);
        for (const trozo of trozosDeElementos(xml, { traducibles: DATOS_TRADUCIBLES })) {
            anotar(ruta, trozo);
        }
    }

    for (const ruta of rutasQueCumplen(archivos, ES_CAPITULO)) {
        const xml = leerTexto(archivos, ruta);
        for (const trozo of trozosDeElementos(xml, {
            traducibles: TRADUCIBLES,
            intocables: INTOCABLES,
        })) {
            anotar(ruta, trozo);
        }
    }

    return entradas;
}

/**
 * Vuelve a montar el libro con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {ArrayBuffer} original
 * @returns {ArrayBuffer}
 */
export function reconstructEpub(entradas, original) {
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
