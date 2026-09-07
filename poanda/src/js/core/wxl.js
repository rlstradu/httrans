/**
 * Archivos .wxl, los de los instaladores hechos con WiX (Windows).
 *
 * Son un XML con una cadena por elemento:
 *
 *   <String Id="WelcomeDlgTitle">Welcome</String>
 *
 * Se traduce el texto de dentro; el `Id` es el identificador que usa el
 * instalador y va como contexto. Los elementos pueden venir con prefijo de
 * espacio de nombres (`<loc:String>`), y se admiten igual.
 *
 * Como en el resto de formatos, se sustituye solo el texto: la cabecera del
 * archivo, la cultura declarada y los atributos de cada cadena (`Overridable`,
 * por ejemplo) vuelven tal y como estaban.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';
import { atributo, buscarElementos, desescaparXml, escaparXml } from './xml.js';

/**
 * Lee un archivo .wxl.
 *
 * @param {string} contenido
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseWxlContent(contenido) {
    const texto = String(contenido ?? '');
    const entradas = [];

    for (const cadena of buscarElementos(texto, 'String')) {
        const id = atributo(cadena.atributos, 'Id');
        if (!id) continue;

        const original = desescaparXml(cadena.contenido);
        if (!original.trim()) continue;

        entradas.push({
            msgid: original,
            msgstr: '',
            msgctxt: id,
            comments: [],
            isHeader: false,
            valorInicio: cadena.contenidoInicio,
            valorFin: cadena.contenidoFin,
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

    return entradas;
}

/**
 * Vuelve a escribir el archivo con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {string} original Contenido con el que se abrió el archivo.
 * @returns {string}
 */
export function reconstructWxl(entradas, original) {
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
            texto: escaparXml(traduccion),
        });
    }

    return sustituirTramos(original, tramos);
}
