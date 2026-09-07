/**
 * Archivos .json de traducción, los de las aplicaciones web y móviles.
 *
 * Cada clave es un identificador y su valor, el texto que se traduce. Casi
 * siempre vienen con las claves agrupadas por pantallas o secciones:
 *
 *   {
 *     "menu": { "guardar": "Save", "cancelar": "Cancel" },
 *     "errores": { "vacio": "This field is required" }
 *   }
 *
 * El contexto del segmento es la ruta entera de la clave ("menu.guardar"), que
 * es como se nombran en el código y como se buscan.
 *
 * QUÉ CAMBIÓ Y POR QUÉ
 *
 * El lector anterior solo entendía archivos planos: con un archivo agrupado
 * como el de arriba, los grupos se perdían al guardar y el archivo salía con
 * las claves sueltas y ordenadas alfabéticamente. Un archivo así ya no lo lee
 * la aplicación de la que salió, y el desperfecto no se ve hasta que alguien lo
 * instala. Además reordenaba las claves y se dejaba por el camino todo lo que
 * no fuera texto (números, verdadero/falso, listas).
 *
 * Ahora se hace como en el resto de formatos: se anota dónde está cada texto y
 * al guardar se sustituye solo eso. El archivo vuelve con sus grupos, su orden,
 * su sangría y sus valores no traducibles intactos.
 */
import { countWords } from './text.js';
import { cadenasDelJson } from './json-recorrido.js';
import { sustituirTramos } from './tramos.js';

/**
 * Lee un archivo JSON de traducción.
 *
 * @param {string} contenido
 * @returns {Array<Object>} Entradas para el editor.
 */
function parseJsonProject(contenido) {
    const texto = String(contenido ?? '');

    return cadenasDelJson(texto)
        .filter((cadena) => cadena.valor !== '')
        .map((cadena) => ({
            comments: [],
            msgctxt: cadena.clave,
            msgid: cadena.valor,
            msgstr: '',
            isHeader: false,
            fuzzy: false,
            valorInicio: cadena.inicio,
            valorFin: cadena.fin,
            sentenceSegments: [
                {
                    original: cadena.valor,
                    translation: '',
                    wordCountOriginal: countWords(cadena.valor),
                    wordCountTranslation: 0,
                    isTranslated: false,
                },
            ],
        }));
}

/**
 * Vuelve a escribir el archivo con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {string} original Contenido con el que se abrió el archivo.
 * @returns {string}
 */
function reconstructJson(entradas, original) {
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
            // JSON.stringify pone las comillas y escapa lo que haga falta: unas
            // comillas o un salto de línea dentro de la traducción romperían el
            // archivo si se metieran tal cual.
            texto: JSON.stringify(traduccion),
        });
    }

    return sustituirTramos(original, tramos);
}

export { parseJsonProject, reconstructJson };
