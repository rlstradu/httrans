/**
 * Archivos DITA (.dita y .ditamap), el XML con el que se escribe documentación
 * técnica por trozos reutilizables.
 *
 * Se traduce el texto de los elementos que llevan texto para quien lee: el
 * título, el resumen, los párrafos, los puntos de una lista, los pasos de un
 * procedimiento, las notas. Se deja fuera todo lo demás, y en particular:
 *
 * - <codeblock>, <pre> y <codeph>: son código, se copian tal cual.
 * - Los identificadores, las referencias a otros archivos y los atributos
 *   internos, que es lo que mantiene unido el conjunto de documentos.
 *
 * Sí se traduce el atributo `alt` de las imágenes, que es el texto que lee en
 * voz alta un lector de pantalla y que se olvida siempre.
 *
 * Un elemento anidado dentro de otro traducible no se cuenta dos veces: si un
 * párrafo lleva dentro un <term>, se traduce el párrafo entero (con el <term>
 * dentro, como una etiqueta más), porque la frase hay que verla completa.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';
import { buscarElementos, desescaparXml, escaparDejandoEtiquetas } from './xml.js';

/** Elementos cuyo texto se traduce. */
const TRADUCIBLES = [
    'title',
    'navtitle',
    'searchtitle',
    'shortdesc',
    'abstract',
    'p',
    'li',
    'note',
    'desc',
    'cmd',
    'info',
    'stepresult',
    'result',
    'sectiontitle',
    'q',
    'entry',
    'dt',
    'dd',
    'ph',
    'keyword',
    'term',
];

/** Elementos cuyo contenido no se toca aunque lleve texto dentro. */
const INTOCABLES = ['codeblock', 'pre', 'codeph', 'systemoutput', 'userinput', 'filepath'];

/**
 * Lee un archivo DITA.
 *
 * @param {string} contenido
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseDitaContent(contenido) {
    const texto = String(contenido ?? '');

    const prohibidos = INTOCABLES.flatMap((nombre) => buscarElementos(texto, nombre));
    const dentroDeIntocable = (posicion) =>
        prohibidos.some((zona) => posicion > zona.inicio && posicion < zona.fin);

    const encontrados = TRADUCIBLES.flatMap((nombre) =>
        buscarElementos(texto, nombre).map((elemento) => ({ ...elemento, nombre })),
    ).sort((a, b) => a.inicio - b.inicio);

    const trozos = [];

    for (const elemento of encontrados) {
        if (dentroDeIntocable(elemento.inicio)) continue;

        // Si ya hay un elemento traducible que lo envuelve, este va dentro de
        // aquel: se traduce la frase entera, no sus pedazos.
        const yaContado = trozos.some(
            (otro) => elemento.inicio > otro.inicio && elemento.fin <= otro.fin,
        );
        if (yaContado) continue;

        const original = desescaparXml(elemento.contenido).trim();
        if (!original) continue;

        trozos.push({
            inicio: elemento.contenidoInicio,
            fin: elemento.contenidoFin,
            texto: elemento.contenido,
            original,
            etiqueta: elemento.nombre,
        });
    }

    // Textos alternativos de las imágenes, que están en un atributo y no dentro
    // del elemento.
    for (const alternativo of textosAlternativos(texto)) {
        if (dentroDeIntocable(alternativo.inicio)) continue;
        trozos.push(alternativo);
    }

    trozos.sort((a, b) => a.inicio - b.inicio);

    return trozos.map((trozo) => ({
        msgid: trozo.original,
        msgstr: '',
        msgctxt: trozo.etiqueta,
        comments: [],
        isHeader: false,
        valorInicio: trozo.inicio,
        valorFin: trozo.fin,
        enAtributo: Boolean(trozo.enAtributo),
        sentenceSegments: [
            {
                original: trozo.original,
                translation: '',
                wordCountOriginal: countWords(trozo.original),
                wordCountTranslation: 0,
                isTranslated: false,
            },
        ],
    }));
}

/**
 * Busca los atributos `alt` con texto.
 *
 * @param {string} texto
 * @returns {Array<Object>}
 */
function textosAlternativos(texto) {
    const encontrados = [];
    const busca = /\balt\s*=\s*"([^"]*)"/g;
    let coincidencia;

    while ((coincidencia = busca.exec(texto)) !== null) {
        const valor = coincidencia[1].trim();
        if (!valor) continue;
        const inicio = coincidencia.index + coincidencia[0].indexOf('"') + 1;
        encontrados.push({
            inicio,
            fin: inicio + coincidencia[1].length,
            original: desescaparXml(valor),
            etiqueta: 'alt',
            enAtributo: true,
        });
    }

    return encontrados;
}

/**
 * Vuelve a escribir el archivo con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {string} original Contenido con el que se abrió el archivo.
 * @returns {string}
 */
export function reconstructDita(entradas, original) {
    const tramos = [];

    for (const entrada of entradas || []) {
        if (entrada.valorInicio === undefined) continue;
        const traduccion = (entrada.sentenceSegments || [])
            .map((s) => s.translation || '')
            .join('');
        if (!traduccion) continue;

        const escapada = escaparDejandoEtiquetas(traduccion);
        tramos.push({
            inicio: entrada.valorInicio,
            fin: entrada.valorFin,
            // En un atributo hay que escapar además las comillas, que son las
            // que lo cierran.
            texto: entrada.enAtributo ? escapada.replace(/"/g, '&quot;') : escapada,
        });
    }

    return sustituirTramos(original, tramos);
}
