/**
 * Archivos .md, de Markdown: el formato de los README, la documentación y
 * muchos blogs.
 *
 * Aquí la decisión de fondo es **qué es un segmento**. Poanda parte por bloques:
 * un título es un segmento, un párrafo es un segmento, cada punto de una lista
 * es un segmento y cada celda de una tabla es un segmento. Lo que va dentro del
 * texto —el código entre acentos graves, los enlaces, la negrita— se queda
 * dentro del segmento, tal y como está escrito.
 *
 * La alternativa era cortar también por dentro, en cada trozo de código o de
 * enlace, que es lo que hace Locversia. Se ha descartado a propósito: convierte
 * "pulsa `Guardar` para terminar" en tres segmentos sueltos ("pulsa", "para
 * terminar") y traducir a trozos, sin ver la frase entera, es la forma más
 * rápida de que una traducción quede mal. Los CAT tools serios tratan el código
 * como una etiqueta dentro de la frase, no como una frontera.
 *
 * Lo que no se traduce, y por qué:
 *
 * - Los bloques de código, tanto los de ``` como los que van con cuatro espacios
 *   de sangría: son instrucciones para un ordenador.
 * - El bloque de datos del principio (el que va entre `---`): son campos
 *   internos del generador del sitio.
 * - Las líneas de HTML suelto y las rayas de separación.
 * - La fila de guiones de una tabla, que marca la alineación de las columnas.
 * - Las definiciones de enlaces del final ([1]: https://...).
 *
 * Al guardar se sustituye solo el texto de cada bloque, así que la sangría, los
 * guiones de las listas, las almohadillas de los títulos, las líneas en blanco y
 * todo lo que no se traduce vuelven exactamente igual.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';

/** Línea que abre o cierra un bloque de código con acentos graves o tildes. */
const VALLA = /^(\s{0,3})(`{3,}|~{3,})/;

/** Título: de una a seis almohadillas. */
const TITULO = /^(\s{0,3}#{1,6}\s+)(.*?)(\s+#+\s*)?$/;

/** Punto de una lista: guion, asterisco, más, o número seguido de punto. */
const PUNTO_DE_LISTA = /^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/;

/** Cita: una o varias veces el signo de mayor que. */
const CITA = /^(\s{0,3}(?:>\s?)+)(.*)$/;

/** Raya de separación: tres o más guiones, asteriscos o guiones bajos. */
const SEPARACION = /^\s{0,3}([-*_])\s*(\1\s*){2,}$/;

/** Fila de guiones de una tabla: la que dice cómo se alinea cada columna. */
const ALINEACION_DE_TABLA = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Definición de enlace del final del documento. */
const DEFINICION_DE_ENLACE = /^\s{0,3}\[[^\]]+\]:\s*\S+/;

/** Línea de HTML suelto. */
const HTML_SUELTO = /^\s{0,3}</;

/**
 * Encuentra los trozos traducibles de un documento Markdown.
 *
 * @param {string} contenido
 * @returns {Array<{inicio: number, fin: number, texto: string}>}
 */
function trozosTraducibles(contenido) {
    const lineas = String(contenido ?? '').split('\n');
    const trozos = [];

    let posicion = 0;
    let dentroDeValla = false;
    let marcaDeValla = '';
    let dentroDeDatos = false;
    // Un párrafo puede ocupar varias líneas seguidas; se acumulan y se cierran
    // al llegar a una línea en blanco o a algo que no sea un párrafo.
    let parrafo = null;

    const cerrarParrafo = () => {
        if (parrafo) trozos.push(parrafo);
        parrafo = null;
    };

    for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i];
        const inicioLinea = posicion;
        posicion += linea.length + 1;

        // Bloque de datos del principio, entre rayas de tres guiones.
        if (i === 0 && linea.trim() === '---') {
            dentroDeDatos = true;
            continue;
        }
        if (dentroDeDatos) {
            if (linea.trim() === '---' || linea.trim() === '...') dentroDeDatos = false;
            continue;
        }

        const valla = linea.match(VALLA);
        if (valla) {
            cerrarParrafo();
            if (!dentroDeValla) {
                dentroDeValla = true;
                marcaDeValla = valla[2][0];
            } else if (valla[2][0] === marcaDeValla) {
                dentroDeValla = false;
            }
            continue;
        }
        if (dentroDeValla) continue;

        if (linea.trim() === '') {
            cerrarParrafo();
            continue;
        }

        // Código con sangría: cuatro espacios o una tabulación, pero solo si no
        // venimos de un párrafo (dentro de una lista, esa sangría es continuación).
        if (/^(    |\t)/.test(linea) && !parrafo) continue;

        if (SEPARACION.test(linea) || ALINEACION_DE_TABLA.test(linea)) {
            cerrarParrafo();
            continue;
        }

        if (DEFINICION_DE_ENLACE.test(linea) || HTML_SUELTO.test(linea)) {
            cerrarParrafo();
            continue;
        }

        const titulo = linea.match(TITULO);
        if (titulo) {
            cerrarParrafo();
            const desde = titulo[1].length;
            trozos.push({
                inicio: inicioLinea + desde,
                fin: inicioLinea + desde + titulo[2].length,
                texto: titulo[2],
            });
            continue;
        }

        // Fila de tabla: cada celda es su propio segmento, porque son textos
        // independientes que se traducen por separado.
        if (linea.includes('|') && /^\s*\|/.test(linea)) {
            cerrarParrafo();
            trozos.push(...celdasDeLaFila(linea, inicioLinea));
            continue;
        }

        const cita = linea.match(CITA);
        if (cita) {
            cerrarParrafo();
            const desde = cita[1].length;
            trozos.push({
                inicio: inicioLinea + desde,
                fin: inicioLinea + linea.length,
                texto: cita[2],
            });
            continue;
        }

        const punto = linea.match(PUNTO_DE_LISTA);
        if (punto) {
            cerrarParrafo();
            const desde = punto[1].length;
            trozos.push({
                inicio: inicioLinea + desde,
                fin: inicioLinea + linea.length,
                texto: punto[2],
            });
            continue;
        }

        // Párrafo: se abre o se alarga con esta línea.
        if (parrafo) {
            parrafo.fin = inicioLinea + linea.length;
            parrafo.texto += `\n${linea}`;
        } else {
            parrafo = {
                inicio: inicioLinea,
                fin: inicioLinea + linea.length,
                texto: linea,
            };
        }
    }

    cerrarParrafo();

    return trozos.filter((t) => t.texto.trim() !== '');
}

/**
 * Parte una fila de tabla en celdas, anotando dónde está cada una.
 *
 * @param {string} linea
 * @param {number} inicioLinea
 * @returns {Array<{inicio: number, fin: number, texto: string}>}
 */
function celdasDeLaFila(linea, inicioLinea) {
    const celdas = [];
    let desde = linea.indexOf('|') + 1;

    for (let i = desde; i <= linea.length; i++) {
        // Una barra escapada es parte del texto de la celda, no un separador.
        const esSeparador = linea[i] === '|' && linea[i - 1] !== '\\';
        if (!esSeparador && i !== linea.length) continue;

        const crudo = linea.slice(desde, i);
        const espaciosDelante = crudo.length - crudo.trimStart().length;
        const contenido = crudo.trim();

        if (contenido) {
            celdas.push({
                inicio: inicioLinea + desde + espaciosDelante,
                fin: inicioLinea + desde + espaciosDelante + contenido.length,
                texto: contenido,
            });
        }

        desde = i + 1;
    }

    return celdas;
}

/**
 * Lee un documento Markdown.
 *
 * @param {string} contenido
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseMdContent(contenido) {
    return trozosTraducibles(contenido).map((trozo) => ({
        msgid: trozo.texto,
        msgstr: '',
        comments: [],
        isHeader: false,
        valorInicio: trozo.inicio,
        valorFin: trozo.fin,
        sentenceSegments: [
            {
                original: trozo.texto,
                translation: '',
                wordCountOriginal: countWords(trozo.texto),
                wordCountTranslation: 0,
                isTranslated: false,
            },
        ],
    }));
}

/**
 * Vuelve a escribir el documento con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {string} original Contenido con el que se abrió el archivo.
 * @returns {string}
 */
export function reconstructMd(entradas, original) {
    const tramos = [];

    for (const entrada of entradas || []) {
        if (entrada.valorInicio === undefined) continue;
        const traduccion = (entrada.sentenceSegments || [])
            .map((s) => s.translation || '')
            .join('');
        if (!traduccion) continue;

        tramos.push({ inicio: entrada.valorInicio, fin: entrada.valorFin, texto: traduccion });
    }

    return sustituirTramos(original, tramos);
}
