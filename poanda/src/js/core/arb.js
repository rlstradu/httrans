/**
 * Archivos .arb, los de las aplicaciones hechas con Flutter.
 *
 * Son un JSON plano donde cada clave es una cadena y las claves que empiezan
 * por arroba son información sobre la cadena anterior, no texto que traducir:
 *
 *   {
 *     "@@locale": "en",
 *     "saveButton": "Save",
 *     "@saveButton": {
 *       "description": "Botón de la barra principal",
 *       "placeholders": { ... }
 *     }
 *   }
 *
 * Se traducen los valores de texto. La `description` del bloque de arroba es
 * una nota del programador y va al icono de comentarios; el resto del bloque
 * (los `placeholders`, por ejemplo) se deja intacto.
 *
 * El archivo no se vuelve a escribir con JSON.stringify, aunque sería lo cómodo:
 * eso reordenaría las claves, cambiaría la sangría y se llevaría por delante los
 * bloques de arroba que el programa no supiera reconstruir. En vez de eso se
 * recorre el texto original anotando dónde empieza y acaba cada valor, y al
 * guardar se sustituye solo eso.
 *
 * Las llaves de ICU ({name}, {count, plural, ...}) son etiquetas para el editor
 * y vuelven tal cual: no se tocan aquí.
 */
import { countWords } from './text.js';
import { cadenasDelJson } from './json-recorrido.js';
import { sustituirTramos } from './tramos.js';

/**
 * Lee un archivo .arb.
 *
 * @param {string} contenido
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseArbContent(contenido) {
    const texto = String(contenido ?? '');
    // Un .arb es plano por definición, así que solo interesa el primer nivel:
    // lo que va dentro de un bloque de arroba (los placeholders, por ejemplo)
    // no es texto que nadie tenga que traducir.
    const claves = cadenasDelJson(texto).filter((c) => !c.clave.includes('.'));

    // Las notas del programador viven en el bloque "@clave", que se lee aparte
    // con JSON.parse porque ahí sí da igual de dónde salga cada cosa.
    const notas = new Map();
    try {
        const paquete = JSON.parse(texto);
        for (const [clave, valor] of Object.entries(paquete || {})) {
            if (!clave.startsWith('@') || !valor || typeof valor !== 'object') continue;
            if (valor.description) notas.set(clave.slice(1), String(valor.description));
        }
    } catch {
        // Un archivo con algún fallo se sigue pudiendo traducir; lo único que
        // se pierde son las notas.
    }

    const entradas = [];

    for (const { clave, valor, inicio, fin } of claves) {
        // Las claves de arroba describen otra cadena; no se traducen.
        if (clave.startsWith('@')) continue;
        if (!valor) continue;

        const nota = notas.get(clave);

        entradas.push({
            msgid: valor,
            msgstr: '',
            msgctxt: clave,
            comments: nota ? [`#. ${nota}`] : [],
            isHeader: false,
            // Incluye las comillas: al guardar se sustituye la cadena entera,
            // ya escapada por JSON.stringify.
            valorInicio: inicio,
            valorFin: fin,
            sentenceSegments: [
                {
                    original: valor,
                    translation: '',
                    wordCountOriginal: countWords(valor),
                    wordCountTranslation: 0,
                    isTranslated: false,
                },
            ],
        });
    }

    return entradas;
}

/**
 * Vuelve a escribir el archivo con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {string} original Contenido con el que se abrió el archivo.
 * @returns {string}
 */
export function reconstructArb(entradas, original) {
    const tramos = [];

    for (const entrada of entradas || []) {
        if (entrada.valorInicio === undefined) continue;
        const traduccion = (entrada.sentenceSegments || [])
            .map((s) => s.translation || '')
            .join('');
        if (!traduccion) continue;

        tramos.push({
            inicio: entrada.valorInicio,
            fin: entrada.valorFin,
            // JSON.stringify pone las comillas y escapa lo que haga falta: un
            // salto de línea o unas comillas dentro de la traducción romperían
            // el archivo si se metieran tal cual.
            texto: JSON.stringify(traduccion),
        });
    }

    return sustituirTramos(original, tramos);
}
