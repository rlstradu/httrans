/**
 * Lo justo de XML para los formatos que lo usan. Aquí, el TTML de las
 * plataformas y las televisiones (y sus primos DFXP e IMSC).
 *
 * Traído de Poanda tal cual: es el mismo problema y la misma solución, y tener
 * dos copias que se separan con el tiempo es peor que tener una que se copia.
 *
 * No se usa el analizador del navegador (DOMParser) a propósito. Ese analizador
 * devuelve un árbol, y de un árbol solo se puede volver a un archivo
 * escribiéndolo entero, que es justo lo que aquí no se quiere: al reescribir un
 * TTML se pierden la sangría, el orden de los atributos, los comentarios y la
 * forma exacta de cada etiqueta vacía, y un control de calidad de plataforma
 * mira esas cosas. Así que se recorre el archivo buscando los elementos que
 * interesan y se anota dónde está cada texto, para poder sustituir solo eso.
 */

/** Entidades que hay que escribir escapadas dentro de un texto XML. */
const ESCAPES = [
    [/&/g, '&amp;'],
    [/</g, '&lt;'],
    [/>/g, '&gt;'],
];

/**
 * Prepara un texto para meterlo dentro de un elemento XML.
 *
 * @param {string} texto
 * @returns {string}
 */
export function escaparXml(texto) {
    let salida = String(texto ?? '');
    for (const [busca, pon] of ESCAPES) salida = salida.replace(busca, pon);
    return salida;
}

/**
 * Prepara un texto para meterlo dentro del HTML de la página.
 *
 * Es lo mismo que escaparXml más las comillas, que en HTML hacen falta porque
 * este texto acaba también dentro de atributos (el título de una etiqueta, el
 * término al que apunta un resaltado).
 *
 * @param {string} texto
 * @returns {string}
 */
export function escaparHtml(texto) {
    return escaparXml(texto).replace(/"/g, '&quot;');
}

/**
 * Deshace las entidades de un texto XML, incluidas las numéricas (&#39;).
 *
 * @param {string} texto
 * @returns {string}
 */
export function desescaparXml(texto) {
    return String(texto ?? '')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        // El & va el último: si fuera el primero, "&amp;lt;" acabaría siendo "<"
        // en lugar del texto "&lt;" que era.
        .replace(/&amp;/g, '&');
}

/**
 * Etiqueta con pinta de serlo: un nombre y, si acaso, atributos.
 * Sirve para distinguir `<b>` de un "menor que" suelto en medio de una frase.
 */
const PARECE_ETIQUETA = /^<\/?[a-z][\w.-]*(?::[\w.-]+)?(\s[^<>]*)?\/?>$/i;

/**
 * Escapa un texto para meterlo dentro de un elemento, pero dejando en pie las
 * etiquetas que lleve dentro.
 *
 * Hace falta en los formatos donde el segmento incluye el marcado interno
 * (XLIFF, DITA): quien traduce ve `<g id="1">negrita</g>` y tiene que poder
 * copiarlo a la traducción. Si se escapara todo, esa etiqueta se convertiría en
 * texto visible; si no se escapara nada, un "&" o un "<" sueltos escritos por
 * quien traduce dejarían el archivo roto y sin abrir.
 *
 * @param {string} texto
 * @returns {string}
 */
export function escaparDejandoEtiquetas(texto) {
    return (
        String(texto ?? '')
            // Un "&" que no empiece una entidad se escapa; "&amp;" o "&#39;" ya
            // escritos se quedan como están.
            .replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
            .replace(/<[^<>]*>?/g, (trozo) =>
                PARECE_ETIQUETA.test(trozo)
                    ? trozo
                    : trozo.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
            )
    );
}

/**
 * Lee un atributo de la parte de dentro de una etiqueta de apertura.
 *
 * @param {string} atributos Lo que hay entre el nombre de la etiqueta y el ">".
 * @param {string} nombre Nombre del atributo, tal cual aparece.
 * @returns {string|null} Su valor ya sin entidades, o null si no está.
 */
export function atributo(atributos, nombre) {
    const busca = new RegExp(`\\b${nombre}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
    const encontrado = String(atributos ?? '').match(busca);
    if (!encontrado) return null;
    return desescaparXml(encontrado[2] !== undefined ? encontrado[2] : encontrado[3]);
}

/**
 * Busca los elementos de un nombre dado y anota dónde está cada uno.
 *
 * Solo encuentra elementos con apertura y cierre; los vacíos (`<x/>`) no traen
 * texto que traducir. Acepta un prefijo de espacio de nombres, porque los .wxl
 * a veces escriben `<loc:String>`.
 *
 * @param {string} texto Contenido del archivo.
 * @param {string} nombre Nombre del elemento, sin prefijo.
 * @param {number} [desde] Posición desde la que buscar.
 * @param {number} [hasta] Posición hasta la que buscar.
 * @returns {Array<{atributos: string, contenido: string, inicio: number,
 *   fin: number, contenidoInicio: number, contenidoFin: number}>}
 */
export function buscarElementos(texto, nombre, desde = 0, hasta = Infinity) {
    // Se busca dentro del trozo pedido, no en el archivo entero descartando
    // luego lo que caiga fuera. La diferencia importa: un elemento vacío
    // (`<translation/>`) no tiene cierre, y buscando en todo el archivo la
    // pareja de apertura y cierre acabaría emparejándolo con el cierre del
    // elemento siguiente, tragándose de paso todo lo que hubiera en medio.
    const cadena = String(texto ?? '');
    const principio = Math.max(0, desde);
    const trozo = cadena.slice(principio, hasta === Infinity ? undefined : hasta);

    const busca = new RegExp(
        `<(?:[\\w.-]+:)?${nombre}(\\s[^>]*?)?>((?:(?!<(?:[\\w.-]+:)?${nombre}[\\s/>])[\\s\\S])*?)<\\/(?:[\\w.-]+:)?${nombre}\\s*>`,
        'g',
    );

    const encontrados = [];
    let coincidencia;
    while ((coincidencia = busca.exec(trozo)) !== null) {
        const inicio = principio + coincidencia.index;
        const abertura = coincidencia[0].indexOf('>') + 1;
        encontrados.push({
            atributos: coincidencia[1] || '',
            contenido: coincidencia[2],
            inicio,
            fin: inicio + coincidencia[0].length,
            contenidoInicio: inicio + abertura,
            contenidoFin: inicio + abertura + coincidencia[2].length,
        });
    }

    return encontrados;
}
