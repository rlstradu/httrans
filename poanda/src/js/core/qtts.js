/**
 * Archivos .ts de Qt Linguist (aplicaciones hechas con Qt).
 *
 * Son un XML agrupado por contextos, normalmente la clase del programa donde
 * aparece cada texto:
 *
 *   <context>
 *     <name>MainWindow</name>
 *     <message>
 *       <location filename="mainwindow.cpp" line="42"/>
 *       <source>Save</source>
 *       <extracomment>Botón de la barra</extracomment>
 *       <translation type="unfinished"></translation>
 *     </message>
 *   </context>
 *
 * Se traduce el <translation>. El <source> es el original, el <name> del
 * contexto va en la etiqueta gris del segmento y los comentarios del
 * programador (<comment> y <extracomment>) van al icono de comentarios.
 *
 * Dos detalles del formato que importan:
 *
 * - Una traducción vacía se escribe `<translation type="unfinished"></translation>`
 *   o, más a menudo, `<translation type="unfinished"/>`. Al traducirla hay que
 *   quitar ese `type`, porque es lo que le dice a Qt que la cadena ya está
 *   hecha. Si se deja, la traducción está en el archivo pero el programa no la
 *   usa.
 * - Los <location> dicen en qué archivo y en qué línea aparece cada texto. Los
 *   genera Qt y no son cosa nuestra, así que se dejan intactos. La versión de
 *   Locversia reescribe el archivo entero y los sustituye por un <location/>
 *   vacío, con lo que la siguiente actualización del proyecto los da por
 *   perdidos.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';
import { atributo, buscarElementos, desescaparXml, escaparXml } from './xml.js';

/**
 * Dice si un archivo .ts es de Qt y no de TypeScript, que comparten extensión.
 *
 * @param {string} contenido
 * @returns {boolean}
 */
export function esTraduccionDeQt(contenido) {
    const principio = String(contenido ?? '').slice(0, 2000);
    return /<\?xml/i.test(principio) && /<TS[\s>]/i.test(principio);
}

/**
 * Lee un archivo .ts de Qt.
 *
 * @param {string} contenido
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseQtTsContent(contenido) {
    const texto = String(contenido ?? '');

    // Los contextos se apuntan primero para poder decir a cuál pertenece cada
    // mensaje mirando en qué tramo del archivo cae.
    const contextos = buscarElementos(texto, 'context').map((contexto) => {
        const [nombre] = buscarElementos(texto, 'name', contexto.inicio, contexto.fin);
        return {
            inicio: contexto.inicio,
            fin: contexto.fin,
            nombre: nombre ? desescaparXml(nombre.contenido).trim() : '',
        };
    });

    const nombreDelContexto = (posicion) =>
        contextos.find((c) => posicion > c.inicio && posicion < c.fin)?.nombre || '';

    const entradas = [];

    for (const mensaje of buscarElementos(texto, 'message')) {
        const [fuente] = buscarElementos(texto, 'source', mensaje.inicio, mensaje.fin);
        if (!fuente) continue;

        const original = desescaparXml(fuente.contenido);
        if (!original) continue;

        const traduccion = elementoTraduccion(texto, mensaje);
        const yaTraducido = traduccion ? desescaparXml(traduccion.contenido) : '';

        const notas = [
            ...buscarElementos(texto, 'comment', mensaje.inicio, mensaje.fin),
            ...buscarElementos(texto, 'extracomment', mensaje.inicio, mensaje.fin),
        ]
            .map((e) => desescaparXml(e.contenido).trim())
            .filter(Boolean)
            .map((nota) => `#. ${nota}`);

        entradas.push({
            msgid: original,
            msgstr: yaTraducido,
            msgctxt: nombreDelContexto(mensaje.inicio),
            comments: notas,
            isHeader: false,
            // El elemento entero, porque al traducir hay que rehacer la etiqueta
            // de apertura para quitarle el `type="unfinished"`.
            traduccionInicio: traduccion ? traduccion.inicio : undefined,
            traduccionFin: traduccion ? traduccion.fin : undefined,
            traduccionAtributos: traduccion ? traduccion.atributos : '',
            sentenceSegments: [
                {
                    original,
                    translation: yaTraducido,
                    wordCountOriginal: countWords(original),
                    wordCountTranslation: countWords(yaTraducido),
                    isTranslated: yaTraducido !== '',
                },
            ],
        });
    }

    return entradas;
}

/**
 * Encuentra el <translation> de un mensaje, esté escrito con cierre o vacío.
 *
 * @param {string} texto
 * @param {{inicio: number, fin: number}} mensaje
 * @returns {{atributos: string, contenido: string, inicio: number, fin: number}|null}
 */
function elementoTraduccion(texto, mensaje) {
    const [conCierre] = buscarElementos(texto, 'translation', mensaje.inicio, mensaje.fin);
    if (conCierre) return conCierre;

    // La forma vacía: <translation type="unfinished"/>
    const trozo = texto.slice(mensaje.inicio, mensaje.fin);
    const vacio = trozo.match(/<(?:[\w.-]+:)?translation(\s[^>]*?)?\/>/);
    if (!vacio) return null;

    return {
        atributos: vacio[1] || '',
        contenido: '',
        inicio: mensaje.inicio + vacio.index,
        fin: mensaje.inicio + vacio.index + vacio[0].length,
    };
}

/**
 * Vuelve a escribir el archivo con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {string} original Contenido con el que se abrió el archivo.
 * @returns {string}
 */
export function reconstructQtTs(entradas, original) {
    const tramos = [];

    for (const entrada of entradas || []) {
        if (entrada.traduccionInicio === undefined) continue;
        const traduccion = (entrada.sentenceSegments || [])
            .map((s) => s.translation || '')
            .join('');
        if (!traduccion) continue;

        // Se conservan los atributos que hubiera (por ejemplo `variants`) menos
        // el `type`, que es el que marca la cadena como pendiente.
        const atributos = String(entrada.traduccionAtributos || '')
            .replace(/\s+type\s*=\s*("[^"]*"|'[^']*')/i, '')
            .trimEnd();

        tramos.push({
            inicio: entrada.traduccionInicio,
            fin: entrada.traduccionFin,
            texto: `<translation${atributos}>${escaparXml(traduccion)}</translation>`,
        });
    }

    return sustituirTramos(original, tramos);
}
