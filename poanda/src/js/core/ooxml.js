/**
 * Word (.docx), Excel (.xlsx) y PowerPoint (.pptx).
 *
 * Los tres son un zip con archivos XML dentro. El texto vive en unos pocos:
 *
 *   .docx   word/document.xml, y además las cabeceras, los pies y las notas
 *   .xlsx   xl/sharedStrings.xml, la tabla donde Excel guarda una sola vez cada
 *           texto que se repite por la hoja
 *   .pptx   ppt/slides/slideN.xml, una diapositiva por archivo, y las notas
 *
 * EL PROBLEMA DE LOS TROZOS
 *
 * Word no guarda un párrafo como una frase seguida: lo parte en trozos cada vez
 * que cambia algo del formato, o incluso sin cambiar nada, porque el corrector
 * ortográfico va dejando marcas. Una frase como "pulsa **Guardar** ahora" puede
 * estar guardada en cinco pedazos. Enseñarlos como cinco segmentos sería
 * ilegible y daría traducciones malas: quien traduce necesita la frase entera.
 *
 * Por eso un segmento es **el párrafo**, con sus trozos juntos. Y para no perder
 * por el camino qué llevaba formato, los trozos que lo tienen se enseñan como
 * etiquetas:
 *
 *   pulsa <b1>Guardar</b1> ahora
 *
 * La letra dice qué es —b negrita, i cursiva, u subrayado, g cualquier otra
 * cosa (un color, otra fuente, un tamaño)— y el número distingue una etiqueta de
 * otra dentro del mismo párrafo. Son etiquetas normales de Poanda: se ven en
 * amarillo, se insertan pulsándolas y el aviso del segmento comprueba que estén
 * todas y en pareja, igual que con un %s o un <b> de un archivo PO.
 *
 * Al guardar, cada trozo vuelve a su sitio con el formato que tenía: lo que va
 * dentro de <b1> se escribe en el trozo que llevaba la negrita y lo de fuera en
 * los que no llevaban nada. Mover la etiqueta de sitio en la traducción mueve el
 * formato, que es justo lo que hace falta cuando el adjetivo cambia de lado al
 * cambiar de idioma. Si se borra una etiqueta, se pierde ese formato y ya está:
 * el archivo sigue abriéndose.
 *
 * Todo lo demás del archivo —los estilos, las imágenes, las tablas, las
 * fórmulas de Excel, las transiciones de PowerPoint— vuelve tal cual.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';
import { buscarElementos, desescaparXml, escaparXml } from './xml.js';
import { abrirZip, cerrarZip, escribirTexto, leerTexto, rutasQueCumplen } from './zip.js';

/** Archivos de un .docx que llevan texto de la persona que escribió. */
const ES_DE_WORD = (ruta) =>
    /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(ruta);

/** En un .xlsx, el texto está en la tabla de cadenas compartidas. */
const ES_DE_EXCEL = (ruta) => ruta === 'xl/sharedStrings.xml';

/** En un .pptx, cada diapositiva y sus notas son un archivo. */
const ES_DE_POWERPOINT = (ruta) => /^ppt\/(slides|notesSlides)\/[^/]+\.xml$/.test(ruta);

/**
 * Primero las diapositivas y luego las notas, que es el orden en que se prepara
 * una presentación: primero lo que se ve y después lo que se dice.
 */
const ORDEN_DE_POWERPOINT = (ruta) => (ruta.startsWith('ppt/slides/') ? 0 : 1);

/** En Word, el cuerpo va antes que las cabeceras, los pies y las notas. */
const ORDEN_DE_WORD = (ruta) => (ruta === 'word/document.xml' ? 0 : 1);

/**
 * Cómo se llama cada formato en la etiqueta. El orden importa: se coge el
 * primero que aparezca, así que lo que más se usa va delante.
 */
const NOMBRES_DE_FORMATO = [
    // Word usa <w:b/>, PowerPoint el atributo b="1" del elemento de propiedades.
    { letra: 'b', busca: /<\w*:?b\/>|<\w*:?b\s[^>]*\/>|\bb="(?:1|true)"/ },
    { letra: 'i', busca: /<\w*:?i\/>|<\w*:?i\s[^>]*\/>|\bi="(?:1|true)"/ },
    { letra: 'u', busca: /<\w*:?u[\s/>]|\bu="(?:sng|dbl|heavy)"/ },
];

/**
 * Pone nombre a la etiqueta de un trozo según el formato que lleve.
 *
 * @param {string} propiedades XML de las propiedades del trozo.
 * @param {number} numero Para distinguirla de las demás del mismo párrafo.
 * @returns {string} 'b1', 'i2', 'g3'…
 */
function nombreDeEtiqueta(propiedades, numero) {
    const encontrado = NOMBRES_DE_FORMATO.find((f) => f.busca.test(propiedades));
    // La g es de "grupo": un formato que no es ninguno de los tres de siempre y
    // que no se puede resumir en una letra (un color, una fuente, un tamaño).
    return `${encontrado ? encontrado.letra : 'g'}${numero}`;
}

/**
 * Cosas que aparecen en las propiedades de un trozo y no son formato.
 *
 * Word y PowerPoint dejan ahí marcas suyas —el idioma del corrector, si el
 * texto está "sucio" desde la última revisión, sugerencias de fuente para
 * alfabetos asiáticos— que no cambian cómo se ve el texto. Si contaran como
 * formato, un documento normal saldría con una etiqueta en cada palabra y no
 * habría quien lo tradujera, que es el error clásico de las herramientas que
 * enseñan "etiquetas" de más.
 */
const NO_ES_FORMATO = [
    /<\w*:?(?:lang|noProof|rFonts|kern|spc|smtClean|specVanish|oMath)\b[^>]*\/?>/g,
    /\b(?:lang|altLang|dirty|smtClean|err|noProof|spc|kern|smtId|normalizeH|id)="[^"]*"/g,
];

/**
 * Dice si las propiedades de un trozo cambian de verdad cómo se ve el texto.
 *
 * Cuando no lo cambian, el trozo no lleva etiqueta. Eso no pierde nada: el
 * texto vuelve a ese mismo trozo al guardar, con sus propiedades intactas; lo
 * único que no se puede es moverlo de sitio dentro de la frase, que para algo
 * que no se ve tampoco hace falta.
 *
 * @param {string} propiedades
 * @returns {boolean}
 */
function esFormatoDeVerdad(propiedades) {
    let resto = String(propiedades || '');
    for (const busca of NO_ES_FORMATO) resto = resto.replace(busca, '');
    // Queda formato si sobra algún elemento o algún atributo con valor.
    return /<[^/!?]/.test(resto) || /=\s*"/.test(resto);
}

/**
 * Busca las propiedades de un trozo, estén escritas con cierre o vacías.
 *
 * PowerPoint las escribe casi siempre en una sola etiqueta vacía
 * (`<a:rPr b="1"/>`), donde el formato va en los atributos; Word las escribe
 * con elementos dentro (`<w:rPr><w:b/></w:rPr>`). Se admiten las dos.
 *
 * @param {string} xml
 * @param {string} nombre
 * @param {{inicio: number, fin: number}} corrida
 * @returns {string} Lo que llevan dentro, o sus atributos. Vacío si no hay.
 */
function propiedadesDelTrozo(xml, nombre, corrida) {
    const [conCierre] = buscarElementos(xml, nombre, corrida.inicio, corrida.fin);
    if (conCierre) return conCierre.contenido;

    const trozo = xml.slice(corrida.inicio, corrida.fin);
    const vacia = trozo.match(new RegExp(`<(?:[\\w.-]+:)?${nombre}(\\s[^>]*?)?\\/>`));
    return vacia ? vacia[1] || '' : '';
}

/**
 * Saca los segmentos de un XML donde el texto va repartido en trozos.
 *
 * @param {string} xml
 * @param {{bloque: string, trozo: string, corrida: string, propiedades: string}} nombres
 *   Cómo se llaman en este formato el párrafo, el texto, el trozo con formato y
 *   sus propiedades.
 * @returns {Array<Object>}
 */
function segmentosDelXml(xml, nombres) {
    const segmentos = [];

    for (const grupo of buscarElementos(xml, nombres.bloque)) {
        const textos = buscarElementos(xml, nombres.trozo, grupo.inicio, grupo.fin);
        if (textos.length === 0) continue;

        // Las corridas son los trozos con formato; cada texto vive dentro de una.
        const corridas = buscarElementos(xml, nombres.corrida, grupo.inicio, grupo.fin);

        const partes = [];
        let conFormato = 0;
        let original = '';

        for (const texto of textos) {
            const corrida = corridas.find(
                (c) => texto.inicio > c.inicio && texto.fin <= c.fin,
            );
            const propiedades = corrida
                ? propiedadesDelTrozo(xml, nombres.propiedades, corrida)
                : '';

            const tieneFormato = esFormatoDeVerdad(propiedades);
            const contenido = desescaparXml(texto.contenido);

            if (tieneFormato) {
                conFormato += 1;
                const etiqueta = nombreDeEtiqueta(propiedades, conFormato);
                original += `<${etiqueta}>${contenido}</${etiqueta}>`;
                partes.push({
                    inicio: texto.contenidoInicio,
                    fin: texto.contenidoFin,
                    etiqueta,
                });
            } else {
                original += contenido;
                partes.push({
                    inicio: texto.contenidoInicio,
                    fin: texto.contenidoFin,
                    etiqueta: null,
                });
            }
        }

        if (!original.trim()) continue;

        segmentos.push({ original, partes });
    }

    return segmentos;
}

/**
 * Reparte una traducción entre los trozos del párrafo.
 *
 * Lo que va dentro de una etiqueta va al trozo que llevaba ese formato; lo que
 * queda fuera se reparte, en orden, entre los trozos sin formato. Si la
 * traducción trae menos pedazos sueltos que trozos había, los que sobran se
 * quedan vacíos; si trae más, el último se lleva el resto. Así nunca se pierde
 * texto, aunque quien traduce haya quitado o movido etiquetas.
 *
 * @param {string} traduccion
 * @param {Array<{etiqueta: string|null}>} partes
 * @returns {Map<number, string>} Texto que le toca a cada trozo, por posición.
 */
export function repartirEntreTrozos(traduccion, partes) {
    const pedazos = partirPorEtiquetas(traduccion);
    const reparto = new Map();

    // Primero, lo que va con nombre de etiqueta: cada uno a su trozo.
    const sueltos = [];
    for (const pedazo of pedazos) {
        const destino = pedazo.etiqueta
            ? partes.findIndex((p) => p.etiqueta === pedazo.etiqueta)
            : -1;

        if (destino !== -1) {
            reparto.set(destino, (reparto.get(destino) || '') + pedazo.texto);
        } else {
            // Sin etiqueta, o con una que ya no existe en el original: es texto
            // suelto y se reparte entre los trozos sin formato.
            sueltos.push(pedazo.texto);
        }
    }

    const sinFormato = partes
        .map((parte, i) => (parte.etiqueta ? -1 : i))
        .filter((i) => i !== -1);

    sueltos.forEach((texto, i) => {
        const destino = sinFormato[Math.min(i, sinFormato.length - 1)];
        if (destino === undefined) return;
        reparto.set(destino, (reparto.get(destino) || '') + texto);
    });

    // Los trozos a los que no les ha tocado nada se vacían: si se dejaran como
    // estaban, saldría el texto original repetido junto a la traducción.
    partes.forEach((_, i) => {
        if (!reparto.has(i)) reparto.set(i, '');
    });

    return reparto;
}

/**
 * Parte un texto en pedazos, separando lo que va dentro de cada etiqueta.
 *
 * @param {string} texto
 * @returns {Array<{etiqueta: string|null, texto: string}>}
 */
function partirPorEtiquetas(texto) {
    const pedazos = [];
    const busca = /<([a-z]\d+)>([\s\S]*?)<\/\1>/g;
    let desde = 0;
    let encontrada;

    while ((encontrada = busca.exec(texto)) !== null) {
        if (encontrada.index > desde) {
            pedazos.push({ etiqueta: null, texto: texto.slice(desde, encontrada.index) });
        }
        pedazos.push({ etiqueta: encontrada[1], texto: encontrada[2] });
        desde = encontrada.index + encontrada[0].length;
    }

    if (desde < texto.length) pedazos.push({ etiqueta: null, texto: texto.slice(desde) });

    return pedazos.filter((p) => p.texto !== '');
}

/**
 * Lee un archivo de Office comprimido.
 *
 * @param {ArrayBuffer} datos
 * @param {(ruta: string) => boolean} interesa Qué archivos de dentro leer.
 * @param {Object} nombres Cómo se llaman los elementos en este formato.
 * @returns {Array<Object>} Entradas para el editor.
 */
function leerOoxml(datos, interesa, nombres, orden) {
    const archivos = abrirZip(datos);
    const entradas = [];

    for (const ruta of rutasQueCumplen(archivos, interesa, orden)) {
        const xml = leerTexto(archivos, ruta);

        for (const segmento of segmentosDelXml(xml, nombres)) {
            entradas.push({
                msgid: segmento.original,
                msgstr: '',
                comments: [],
                isHeader: false,
                // Dónde vive el texto: en qué archivo de dentro del zip y en qué
                // posiciones de ese archivo.
                archivoInterno: ruta,
                partes: segmento.partes,
                sentenceSegments: [
                    {
                        original: segmento.original,
                        translation: '',
                        wordCountOriginal: countWords(segmento.original),
                        wordCountTranslation: 0,
                        isTranslated: false,
                    },
                ],
            });
        }
    }

    return entradas;
}

/**
 * Vuelve a montar el archivo comprimido con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {ArrayBuffer} original
 * @returns {ArrayBuffer}
 */
function escribirOoxml(entradas, original) {
    const archivos = abrirZip(original);

    // Se agrupa por archivo de dentro: cada uno se reescribe una sola vez.
    const porArchivo = new Map();

    for (const entrada of entradas || []) {
        if (!entrada.archivoInterno || !entrada.partes) continue;
        const traduccion = (entrada.sentenceSegments || [])
            .map((s) => s.translation || '')
            .join('');
        if (!traduccion) continue;

        if (!porArchivo.has(entrada.archivoInterno)) porArchivo.set(entrada.archivoInterno, []);

        const reparto = repartirEntreTrozos(traduccion, entrada.partes);
        entrada.partes.forEach((parte, i) => {
            porArchivo.get(entrada.archivoInterno).push({
                inicio: parte.inicio,
                fin: parte.fin,
                texto: escaparXml(reparto.get(i) || ''),
            });
        });
    }

    for (const [ruta, tramos] of porArchivo) {
        escribirTexto(archivos, ruta, sustituirTramos(leerTexto(archivos, ruta), tramos));
    }

    return cerrarZip(archivos);
}

/** Word: párrafo <w:p>, trozo con formato <w:r>, propiedades <w:rPr>, texto <w:t>. */
const NOMBRES_DE_WORD = { bloque: 'p', corrida: 'r', propiedades: 'rPr', trozo: 't' };

/** Excel: cadena <si>, trozo <r>, propiedades <rPr>, texto <t>. */
const NOMBRES_DE_EXCEL = { bloque: 'si', corrida: 'r', propiedades: 'rPr', trozo: 't' };

/** PowerPoint: párrafo <a:p>, trozo <a:r>, propiedades <a:rPr>, texto <a:t>. */
const NOMBRES_DE_POWERPOINT = { bloque: 'p', corrida: 'r', propiedades: 'rPr', trozo: 't' };

/**
 * Lee un documento de Word.
 *
 * @param {ArrayBuffer} datos
 * @returns {Array<Object>}
 */
export function parseDocxContent(datos) {
    return leerOoxml(datos, ES_DE_WORD, NOMBRES_DE_WORD, ORDEN_DE_WORD);
}

/**
 * @param {Array<Object>} entradas
 * @param {ArrayBuffer} original
 * @returns {ArrayBuffer}
 */
export function reconstructDocx(entradas, original) {
    return escribirOoxml(entradas, original);
}

/**
 * Lee un libro de Excel.
 *
 * @param {ArrayBuffer} datos
 * @returns {Array<Object>}
 */
export function parseXlsxContent(datos) {
    return leerOoxml(datos, ES_DE_EXCEL, NOMBRES_DE_EXCEL);
}

/**
 * @param {Array<Object>} entradas
 * @param {ArrayBuffer} original
 * @returns {ArrayBuffer}
 */
export function reconstructXlsx(entradas, original) {
    return escribirOoxml(entradas, original);
}

/**
 * Lee una presentación de PowerPoint.
 *
 * @param {ArrayBuffer} datos
 * @returns {Array<Object>}
 */
export function parsePptxContent(datos) {
    return leerOoxml(datos, ES_DE_POWERPOINT, NOMBRES_DE_POWERPOINT, ORDEN_DE_POWERPOINT);
}

/**
 * @param {Array<Object>} entradas
 * @param {ArrayBuffer} original
 * @returns {ArrayBuffer}
 */
export function reconstructPptx(entradas, original) {
    return escribirOoxml(entradas, original);
}
