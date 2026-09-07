/**
 * La familia XLIFF: el formato bilingüe estándar del sector y los tres sabores
 * que usan las herramientas de pago.
 *
 *   .xliff / .xlf   el estándar, versiones 1.2 y 2.0
 *   .sdlxliff       Trados Studio
 *   .mxliff         Memsource / Phrase
 *   .mqxliff        memoQ
 *
 * Los tres últimos son XLIFF por dentro; lo que añaden es información propia de
 * cada herramienta (el estado de cada segmento, quién lo tocó y cuándo, la
 * puntuación de la memoria, el esqueleto del archivo original). Esa información
 * es la que hace que el archivo se pueda devolver a Trados o a memoQ y siga
 * sirviendo, así que **no se toca nada de eso**: se abre el archivo, se
 * sustituye el texto de cada <target> y se devuelve todo lo demás intacto.
 *
 * Esto es lo contrario de lo que hace Locversia, que reescribe el archivo entero
 * con una plantilla de XLIFF básico. Con un .sdlxliff eso no es perder detalles:
 * es devolver un archivo que Trados ya no reconoce.
 *
 * SOBRE LAS ETIQUETAS DE DENTRO
 *
 * Un segmento XLIFF puede llevar etiquetas dentro (<g id="1">, <x id="2"/>,
 * <ph>...), que representan el formato o los códigos del documento original.
 * Aquí se enseñan tal cual, como parte del texto, para que se puedan copiar a la
 * traducción: es lo mismo que hace Poanda con el HTML, y el aviso de etiquetas
 * del editor ya comprueba que la traducción lleve las mismas que el original.
 *
 * Al guardar, lo que se escriba se devuelve al archivo escapando solo lo que
 * haría un XML inválido: un "&" suelto o un "<" que no abra una etiqueta
 * conocida. Así una traducción con "Ana & Luis" no rompe el archivo y una con
 * <g id="1">negrita</g> se guarda como la etiqueta que es.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';
import { atributo, buscarElementos, desescaparXml, escaparDejandoEtiquetas } from './xml.js';

/**
 * Deja el contenido de un <source> o <target> como se enseña en el editor: se
 * deshacen las entidades del texto, pero las etiquetas de dentro se quedan.
 *
 * @param {string} contenido XML de dentro del elemento.
 * @returns {string}
 */
function textoDelSegmento(contenido) {
    return String(contenido ?? '')
        .replace(/(<[^<>]*>)|([^<]+)/g, (_, etiqueta, texto) =>
            etiqueta ? etiqueta : desescaparXml(texto),
        )
        .trim();
}

/**
 * Lee un archivo de la familia XLIFF, tanto de la versión 1.2 como de la 2.0.
 *
 * @param {string} contenido
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseXliffContent(contenido) {
    const texto = String(contenido ?? '');
    const entradas = [];

    // La 1.2 agrupa en <trans-unit> y la 2.0 en <segment> dentro de <unit>. Se
    // buscan las dos: así un mismo lector vale para las dos versiones y no hay
    // que adivinar cuál es antes de abrir.
    const unidades = [
        ...buscarElementos(texto, 'trans-unit'),
        ...buscarElementos(texto, 'segment'),
    ].sort((a, b) => a.inicio - b.inicio);

    // Un <segment> de la 2.0 puede vivir dentro de un <trans-unit>... no en un
    // archivo válido, pero si el archivo mezcla versiones se descartan los que
    // caigan dentro de otra unidad ya contada.
    const sinSolapar = unidades.filter(
        (unidad, i) => !unidades.slice(0, i).some((otra) => unidad.inicio < otra.fin),
    );

    const idiomas = idiomasDelArchivo(texto);

    for (const unidad of sinSolapar) {
        const [fuente] = buscarElementos(texto, 'source', unidad.inicio, unidad.fin);
        if (!fuente) continue;

        const original = textoDelSegmento(fuente.contenido);
        if (!original) continue;

        const [destino] = buscarElementos(texto, 'target', unidad.inicio, unidad.fin);
        const vacio = destino ? null : etiquetaVacia(texto, unidad, 'target');
        const traduccion = destino ? textoDelSegmento(destino.contenido) : '';

        const notas = buscarElementos(texto, 'note', unidad.inicio, unidad.fin)
            .map((nota) => desescaparXml(nota.contenido).trim())
            .filter(Boolean)
            .map((nota) => `#. ${nota}`);

        entradas.push({
            msgid: original,
            msgstr: traduccion,
            msgctxt: atributo(unidad.atributos, 'id') || undefined,
            comments: notas,
            isHeader: false,
            sourceLang: idiomas.origen,
            targetLang: idiomas.destino,
            // Dónde escribir la traducción. Hay tres casos: que el <target>
            // exista con su cierre, que exista vacío (<target/>) o que no
            // exista, y entonces hay que ponerlo detrás del <source>.
            destinoInicio: destino ? destino.contenidoInicio : (vacio ? vacio.inicio : fuente.fin),
            destinoFin: destino ? destino.contenidoFin : (vacio ? vacio.fin : fuente.fin),
            destinoHayQueCrear: !destino,
            destinoAtributos: destino ? '' : vacio ? vacio.atributos : '',
            sentenceSegments: [
                {
                    original,
                    translation: traduccion,
                    wordCountOriginal: countWords(original),
                    wordCountTranslation: countWords(traduccion),
                    isTranslated: traduccion !== '',
                },
            ],
        });
    }

    return entradas;
}

/**
 * Busca una etiqueta vacía (<target/>) dentro de una unidad.
 *
 * @param {string} texto
 * @param {{inicio: number, fin: number}} unidad
 * @param {string} nombre
 * @returns {{atributos: string, inicio: number, fin: number}|null}
 */
function etiquetaVacia(texto, unidad, nombre) {
    const trozo = texto.slice(unidad.inicio, unidad.fin);
    const encontrada = trozo.match(new RegExp(`<(?:[\\w.-]+:)?${nombre}(\\s[^>]*?)?\\/>`));
    if (!encontrada) return null;
    return {
        atributos: encontrada[1] || '',
        inicio: unidad.inicio + encontrada.index,
        fin: unidad.inicio + encontrada.index + encontrada[0].length,
    };
}

/**
 * Lee los idiomas declarados en el archivo, en la forma de cada versión.
 *
 * @param {string} texto
 * @returns {{origen: string, destino: string}}
 */
function idiomasDelArchivo(texto) {
    const cabecera = texto.slice(0, 4000);
    return {
        origen:
            (cabecera.match(/\bsource-language\s*=\s*"([^"]*)"/i) ||
                cabecera.match(/\bsrcLang\s*=\s*"([^"]*)"/i) ||
                [])[1] || '',
        destino:
            (cabecera.match(/\btarget-language\s*=\s*"([^"]*)"/i) ||
                cabecera.match(/\btrgLang\s*=\s*"([^"]*)"/i) ||
                [])[1] || '',
    };
}

/**
 * Vuelve a escribir el archivo con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {string} original Contenido con el que se abrió el archivo.
 * @returns {string}
 */
export function reconstructXliff(entradas, original) {
    const tramos = [];

    for (const entrada of entradas || []) {
        if (entrada.destinoInicio === undefined) continue;
        const traduccion = (entrada.sentenceSegments || [])
            .map((s) => s.translation || '')
            .join('');
        if (!traduccion) continue;

        const escrita = escaparDejandoEtiquetas(traduccion);

        if (entrada.destinoHayQueCrear) {
            // No había <target>: se pone uno detrás del <source>, respetando los
            // atributos que tuviera la etiqueta vacía si la había.
            tramos.push({
                inicio: entrada.destinoInicio,
                fin: entrada.destinoFin,
                texto: `<target${entrada.destinoAtributos || ''}>${escrita}</target>`,
            });
        } else {
            tramos.push({ inicio: entrada.destinoInicio, fin: entrada.destinoFin, texto: escrita });
        }
    }

    return sustituirTramos(original, tramos);
}
