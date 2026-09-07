/**
 * Archivos de texto plano.
 *
 * Una línea, un segmento. Es el formato más simple que hay y por eso mismo el
 * que mejor enseña la regla que sigue Poanda con todos: **al guardar se
 * reconstruye sobre el archivo original**, no desde cero. Se recorre el texto
 * tal y como vino y solo se sustituye lo que se ha traducido; las líneas en
 * blanco, la sangría y todo lo que no era un segmento vuelven intactos.
 *
 * Escrito así, abrir un archivo y guardarlo sin tocar nada devuelve el mismo
 * archivo byte a byte, que es la única forma de estar seguro de que no se está
 * perdiendo nada por el camino.
 *
 * Adaptado del lector de Locversia.
 */
import { countWords } from './text.js';

/**
 * Lee un archivo de texto: cada línea con contenido es un segmento.
 *
 * @param {string} contenido
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseTxtContent(contenido) {
    const entradas = [];
    const lineas = String(contenido ?? '').split('\n');

    lineas.forEach((linea, numero) => {
        const texto = linea.trim();
        if (!texto) return;

        entradas.push({
            msgid: texto,
            msgstr: '',
            comments: [],
            isHeader: false,
            // Con qué línea del archivo se corresponde. Es lo que permite
            // devolver cada traducción a su sitio sin depender del orden.
            lineaOriginal: numero,
            sentenceSegments: [
                {
                    original: texto,
                    translation: '',
                    wordCountOriginal: countWords(texto),
                    wordCountTranslation: 0,
                    isTranslated: false,
                },
            ],
        });
    });

    return entradas;
}

/**
 * Vuelve a escribir el archivo con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {string} original Contenido con el que se abrió el archivo.
 * @returns {string}
 */
export function reconstructTxt(entradas, original) {
    const lineas = String(original ?? '').split('\n');

    const porLinea = new Map();
    (entradas || []).forEach((entrada, indice) => {
        const numero = entrada.lineaOriginal !== undefined ? entrada.lineaOriginal : indice;
        porLinea.set(numero, entrada);
    });

    return lineas
        .map((linea, numero) => {
            const entrada = porLinea.get(numero);
            if (!entrada) return linea;

            const traduccion = (entrada.sentenceSegments || [])
                .map((s) => s.translation || '')
                .join('');
            if (!traduccion) return linea;

            // Se sustituye solo el texto, respetando la sangría y los espacios
            // del final. La sustitución va con función a propósito: pasando una
            // cadena, los signos "$&" de una traducción se interpretarían como
            // referencias a lo encontrado y saldría cualquier cosa.
            const texto = linea.trim();
            return linea.replace(texto, () => traduccion);
        })
        .join('\n');
}
