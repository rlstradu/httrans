/**
 * Archivos .resx, los de las aplicaciones .NET (Windows).
 *
 * Son un XML con una entrada por cadena:
 *
 *   <data name="boton.guardar" xml:space="preserve">
 *     <value>Save</value>
 *     <comment>Botón de la barra principal</comment>
 *   </data>
 *
 * Se traduce el <value>. El atributo `name` es el identificador que usa el
 * programa y va como contexto del segmento. El <comment> es una nota del
 * programador y va al icono de comentarios.
 *
 * Lo que NO se toca: los recursos que no son texto (los que llevan `type` o
 * `mimetype`, que son imágenes o datos en binario) y el esquema XSD que estos
 * archivos llevan dentro, unas treinta líneas que Visual Studio necesita. La
 * versión de Locversia reescribe el archivo entero, y con él ese esquema, con
 * una copia fija: cualquier cosa que el archivo tuviera de particular se perdía.
 * Aquí se sustituye solo el texto de cada <value>.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';
import { atributo, buscarElementos, desescaparXml, escaparXml } from './xml.js';

/**
 * Lee un archivo .resx.
 *
 * @param {string} contenido
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseResxContent(contenido) {
    const texto = String(contenido ?? '');
    const entradas = [];

    for (const dato of buscarElementos(texto, 'data')) {
        // Los recursos que no son texto se dejan en paz: un icono no se traduce.
        if (atributo(dato.atributos, 'type') || atributo(dato.atributos, 'mimetype')) continue;

        const nombre = atributo(dato.atributos, 'name');
        if (!nombre) continue;

        const [valor] = buscarElementos(texto, 'value', dato.inicio, dato.fin);
        if (!valor) continue;

        const original = desescaparXml(valor.contenido);
        if (!original) continue;

        const [comentario] = buscarElementos(texto, 'comment', dato.inicio, dato.fin);
        const nota = comentario ? desescaparXml(comentario.contenido).trim() : '';

        entradas.push({
            msgid: original,
            msgstr: '',
            msgctxt: nombre,
            // Se guarda con la marca "#." de las notas del programador, que es
            // la que reparte comentarios.js: en un .resx el <comment> es
            // exactamente eso.
            comments: nota ? [`#. ${nota}`] : [],
            isHeader: false,
            // Dónde vive el texto en el archivo, para poder sustituir solo eso.
            valorInicio: valor.contenidoInicio,
            valorFin: valor.contenidoFin,
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
export function reconstructResx(entradas, original) {
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
