/**
 * Páginas web (.html, .htm).
 *
 * Se traduce el texto de los bloques —títulos, párrafos, puntos de lista,
 * celdas, botones— y los atributos que se leen en voz alta o salen en el
 * buscador: el `alt` de las imágenes, el `title`, el `placeholder` de los
 * formularios, el `aria-label` y la descripción de la página. Se dejan fuera el
 * código, los estilos y todo lo que no lee nadie.
 *
 * QUÉ CAMBIÓ Y POR QUÉ
 *
 * Antes la página se abría con el analizador del navegador y, al guardar, se
 * volvía a escribir entera desde ese árbol. Eso tenía dos problemas serios:
 *
 * - El archivo salía reescrito de arriba abajo: cambiaba la sangría, el orden
 *   de los atributos y las comillas, y las diferencias con el original eran
 *   miles de líneas aunque solo se hubieran traducido dos frases. Para quien
 *   recibe la página traducida y la compara con la suya, eso la hace inservible.
 * - El árbol vivía solo en memoria. Al cerrar Poanda y recuperar el proyecto
 *   desde la lista de recientes, ya no estaba, y exportar dejaba de funcionar
 *   sin decir por qué.
 *
 * Ahora se hace como en el resto de formatos: se anota dónde está cada texto y
 * al guardar se sustituye solo eso. Lo demás vuelve intacto, y el proyecto se
 * puede cerrar y seguir otro día.
 *
 * UNA LIMITACIÓN QUE CONVIENE SABER
 *
 * Los bloques se reconocen por su etiqueta de apertura y su cierre. En HTML el
 * cierre de un párrafo o de un punto de lista se puede omitir, y un archivo
 * escrito así (raro en páginas generadas, más común en HTML escrito a mano hace
 * años) deja esos bloques sin segmentar. No se rompe nada —el texto vuelve tal
 * cual—, pero no aparece para traducir.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';
import { desescaparXml, escaparDejandoEtiquetas } from './xml.js';
import { trozosDeElementos } from './xml-bloques.js';

/** Bloques con texto para quien lee. */
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
    'legend',
    'label',
    'button',
    'summary',
];

/** Lo que no es texto para quien lee. */
const INTOCABLES = ['script', 'style', 'noscript', 'code', 'pre', 'template'];

/** Atributos que sí se traducen, y que suelen olvidarse. */
const ATRIBUTOS = ['alt', 'title', 'placeholder', 'aria-label'];

/**
 * Extrae de una página HTML los textos que se pueden traducir.
 *
 * @param {string} contenido Código HTML completo.
 * @returns {Array<Object>} Segmentos traducibles.
 */
function parseHtmlProject(contenido) {
    const texto = String(contenido ?? '');

    const trozos = [
        ...trozosDeElementos(texto, { traducibles: TRADUCIBLES, intocables: INTOCABLES }),
        ...atributosTraducibles(texto),
        ...descripcionDeLaPagina(texto),
    ].sort((a, b) => a.inicio - b.inicio);

    return trozos.map((trozo, i) => ({
        msgctxt: `${trozo.etiqueta}_${i + 1}`,
        msgid: trozo.original,
        msgstr: '',
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
 * Busca los atributos con texto para quien lee.
 *
 * @param {string} texto
 * @returns {Array<Object>}
 */
function atributosTraducibles(texto) {
    const encontrados = [];

    for (const nombre of ATRIBUTOS) {
        const busca = new RegExp(`\\b${nombre}\\s*=\\s*"([^"]*)"`, 'g');
        let coincidencia;

        while ((coincidencia = busca.exec(texto)) !== null) {
            const valor = coincidencia[1].trim();
            if (!valor) continue;

            const inicio = coincidencia.index + coincidencia[0].indexOf('"') + 1;
            encontrados.push({
                inicio,
                fin: inicio + coincidencia[1].length,
                original: desescaparXml(valor),
                etiqueta: nombre,
                enAtributo: true,
            });
        }
    }

    return encontrados;
}

/**
 * La descripción de la página, que es lo que sale debajo del título en el
 * buscador y lo que más se olvida traducir.
 *
 * @param {string} texto
 * @returns {Array<Object>}
 */
function descripcionDeLaPagina(texto) {
    const encontrados = [];
    const busca = /<meta\s[^>]*name\s*=\s*"description"[^>]*>/gi;
    let coincidencia;

    while ((coincidencia = busca.exec(texto)) !== null) {
        const etiqueta = coincidencia[0];
        const contenido = etiqueta.match(/\bcontent\s*=\s*"([^"]*)"/i);
        if (!contenido || !contenido[1].trim()) continue;

        const inicio =
            coincidencia.index + contenido.index + contenido[0].indexOf('"') + 1;
        encontrados.push({
            inicio,
            fin: inicio + contenido[1].length,
            original: desescaparXml(contenido[1]),
            etiqueta: 'description',
            enAtributo: true,
        });
    }

    return encontrados;
}

/**
 * Rellena las posiciones que falten buscando el original en la página.
 *
 * Hace falta para los proyectos de HTML guardados antes de este cambio: sus
 * segmentos no traen posición porque el lector de entonces no las apuntaba, y
 * sin ellas la exportación devolvería la página en blanco de traducciones. Se
 * emparejan por el texto original, cada uno con el primero que quede libre.
 *
 * @param {Array<Object>} entradas
 * @param {string} original
 * @returns {Array<Object>}
 */
function conPosicionesPuestas(entradas, original) {
    const lista = entradas || [];
    if (lista.some((e) => e.valorInicio !== undefined)) return lista;

    const frescas = parseHtmlProject(original);
    const usadas = new Set();

    return lista.map((entrada) => {
        const i = frescas.findIndex((f, j) => !usadas.has(j) && f.msgid === entrada.msgid);
        if (i === -1) return entrada;
        usadas.add(i);
        return {
            ...entrada,
            valorInicio: frescas[i].valorInicio,
            valorFin: frescas[i].valorFin,
            enAtributo: frescas[i].enAtributo,
        };
    });
}

/**
 * Vuelve a montar la página con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {string} original Código con el que se abrió la página.
 * @returns {string}
 */
function reconstructHtml(entradas, original) {
    const tramos = [];
    const conPosicion = conPosicionesPuestas(entradas, original);

    for (const entrada of conPosicion) {
        if (entrada.valorInicio === undefined) continue;
        const traduccion = (entrada.sentenceSegments || [])
            .map((s) => s.translation || '')
            .join('');
        if (!traduccion) continue;

        const escapada = escaparDejandoEtiquetas(traduccion);
        tramos.push({
            inicio: entrada.valorInicio,
            fin: entrada.valorFin,
            // Dentro de un atributo hay que escapar además las comillas, que son
            // las que lo cierran.
            texto: entrada.enAtributo ? escapada.replace(/"/g, '&quot;') : escapada,
        });
    }

    return sustituirTramos(original, tramos);
}

export { parseHtmlProject, reconstructHtml };
