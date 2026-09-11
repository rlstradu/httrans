/**
 * El formato SRT: leerlo, contarlo y volver a escribirlo.
 *
 * Es el corazón de subpandaTM y no toca la pantalla para nada, así que se puede
 * probar sin navegador. La promesa de fondo de la herramienta se comprueba
 * aquí: abrir un archivo y guardarlo sin traducir nada tiene que devolver el
 * mismo archivo.
 */
import { comoLoEntiendeUnArchivo } from './color.js';

/** Milisegundos a HH:MM:SS,mmm, que es como los escribe un SRT. */
export function formatTime(ms) {
    const horas = Math.floor(ms / 3600000);
    ms %= 3600000;
    const minutos = Math.floor(ms / 60000);
    ms %= 60000;
    const segundos = Math.floor(ms / 1000);
    const milisegundos = ms % 1000;

    return (
        [
            horas.toString().padStart(2, '0'),
            minutos.toString().padStart(2, '0'),
            segundos.toString().padStart(2, '0'),
        ].join(':') +
        ',' +
        milisegundos.toString().padStart(3, '0')
    );
}

/**
 * Un tiempo de subtítulo, escrito como lo escriba quien lo escriba.
 *
 * El formato de manual es HH:MM:SS,mmm, pero por ahí circulan archivos con el
 * punto decimal en lugar de la coma, con una sola cifra en las horas y con
 * cosas escritas detrás. Se busca el tiempo dentro de la línea en vez de
 * partirla por trozos: partirla daba NaN al primer archivo raro, y un NaN en un
 * tiempo se propaga a la duración, a los CPS y al archivo que se exporta.
 */
const TIEMPO = /(\d{1,3}):(\d{1,2}):(\d{1,2})[,.](\d{1,3})/;

/** La línea de tiempos entera: los dos tiempos y la flecha, como venga. */
const LINEA_DE_TIEMPOS = new RegExp(
    `${TIEMPO.source}\\s*-->\\s*${TIEMPO.source}`,
);

/** HH:MM:SS,mmm (o con punto) a milisegundos. NaN si ahí no hay un tiempo. */
export function parseTime(cadena) {
    const partes = String(cadena ?? '').match(TIEMPO);
    if (!partes) return NaN;

    const [, h, m, s, ms] = partes;
    // "00:00:01,5" son 500 ms, no 5: la parte decimal se lee como decimal.
    return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(ms.padEnd(3, '0'));
}

/**
 * Cómo está escrito el archivo por fuera: sus saltos de línea y si acaba en uno.
 *
 * Hace falta para devolverlo como vino. Un archivo hecho en Windows lleva saltos
 * de Windows, y devolverlo con saltos de Unix es devolver un archivo distinto:
 * pesa otra cosa, no coincide en un control de versiones y hay herramientas
 * antiguas que se atragantan.
 *
 * @param {string} contenido
 * @returns {{saltoDeLinea: string, terminaConSalto: boolean}}
 */
export function detectarFormatoSrt(contenido) {
    const texto = String(contenido ?? '');
    return {
        saltoDeLinea: /\r\n/.test(texto) ? '\r\n' : '\n',
        // Un SRT acaba en salto de línea; solo se quita si el de partida no lo
        // traía.
        terminaConSalto: texto === '' || /(?:\r\n|\n|\r)$/.test(texto),
    };
}

/**
 * Milisegundos a HH:MM:SS:FF.
 *
 * Los subtituladores que trabajan para vídeo cuentan en fotogramas, no en
 * milisegundos, porque un subtítulo no puede empezar a mitad de un fotograma.
 */
export function formatFrameTime(ms, fps) {
    const totalSegundos = Math.floor(ms / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    const fotogramas = Math.round(((ms % 1000) / 1000) * fps);

    return [
        horas.toString().padStart(2, '0'),
        minutos.toString().padStart(2, '0'),
        segundos.toString().padStart(2, '0'),
        fotogramas.toString().padStart(2, '0'),
    ].join(':');
}

/** HH:MM:SS:FF a milisegundos. */
export function parseFrameTime(cadena, fps) {
    const partes = cadena.split(':');
    if (partes.length !== 4) throw new Error('Invalid frame time format');

    const [h, m, s, f] = partes.map(Number);
    return h * 3600000 + m * 60000 + s * 1000 + Math.round((f / fps) * 1000);
}

/** Palabras de un texto. */
export function countWords(texto) {
    if (!texto) return 0;
    return texto
        .trim()
        .split(/\s+/)
        .filter((palabra) => palabra.length > 0).length;
}

/**
 * Caracteres de un texto, sin contar las etiquetas ni los saltos de línea.
 *
 * El editor guarda el texto como HTML, así que un `<i>` que el espectador no ve
 * contaría como cuatro caracteres y falsearía tanto el recuento como los CPS.
 *
 * El salto de línea tampoco cuenta: nadie lo lee, y en subtitulado los
 * caracteres se cuentan siempre sin él. Si contara, partir un subtítulo en dos
 * líneas —que es lo que se hace para que se lea mejor— subiría los CPS y
 * parecería que se ha empeorado.
 */
export function countCharactersWithoutTags(texto) {
    if (!texto) return 0;
    return limpiar(texto).replace(/\n/g, '').length;
}

/**
 * Quita de un texto todo lo que el espectador no lee.
 *
 * Las etiquetas, las entidades y las marcas de posición del estilo `{\\an8}`:
 * ninguna de las tres sale en pantalla, así que ninguna puede contar para los
 * caracteres ni para los CPS. Una marca de posición contaba seis caracteres, y
 * seis caracteres de más en un subtítulo corto lo sacan del límite sin que haya
 * nada que recortar.
 */
function limpiar(texto) {
    return textoVisible(texto);
}

/**
 * Lo que de un subtítulo llega de verdad a la pantalla del espectador.
 *
 * Sin etiquetas, sin marcas de posición y con los espacios que el HTML esconde
 * devueltos a espacios. Es lo que se cuenta para los caracteres y los CPS, y es
 * también lo que se mide para saber qué parte de una línea se pasa de largo.
 *
 * @param {string} texto
 * @returns {string}
 */
export function textoVisible(texto) {
    return String(texto ?? '')
        .replace(/<[^<>]*>/g, '')
        .replace(/\{\\[^}]*\}/g, '')
        .replace(/&nbsp;/gi, ' ');
}

/**
 * Caracteres por segundo: cuánto hay que leer y en cuánto tiempo.
 *
 * Es la medida con la que se decide si un subtítulo se puede leer o no.
 */
export function calculateCPS(texto, duracionMs) {
    if (duracionMs <= 0) return 0;
    return (countCharactersWithoutTags(texto) / (duracionMs / 1000)).toFixed(2);
}

/**
 * Lee un archivo SRT y devuelve un subtítulo por bloque.
 *
 * Un bloque son tres partes: el número, los tiempos y el texto, que puede
 * ocupar varias líneas y también puede no haberlo. Se separan por una línea en
 * blanco.
 *
 * Se busca la línea de tiempos en lugar de dar por hecho que es la segunda: hay
 * archivos sin número de subtítulo, y otros con una línea de más antes. Y no se
 * exige que haya texto: una plataforma exporta huecos donde había un subtítulo
 * forzado, y saltárselos corre la numeración de todo lo que viene detrás y le
 * devuelve al cliente un archivo con un subtítulo menos.
 */
export function parseSrtContent(contenido) {
    const subtitulos = [];

    for (const bloque of String(contenido ?? '').split(/(?:\r?\n){2,}/)) {
        const lineas = bloque.replace(/^\uFEFF/, '').trim().split(/\r?\n/);

        const donde = lineas.findIndex((linea) => LINEA_DE_TIEMPOS.test(linea));
        if (donde === -1) continue;

        const timecodes = lineas[donde].trim();
        const texto = lineas.slice(donde + 1).join('\n');
        const [inicio, fin] = timecodes.split(/\s*-->\s*/);
        const startTimeMs = parseTime(inicio);
        const endTimeMs = parseTime(fin);
        const durationMs = endTimeMs - startTimeMs;

        // El número, si lo trae. Si no, el que le toque por orden: hace falta
        // uno para escribir el archivo de vuelta.
        const numero = donde > 0 ? parseInt(lineas[donde - 1], 10) : NaN;

        subtitulos.push({
            index: Number.isFinite(numero) ? numero : subtitulos.length + 1,
            // La línea de tiempos se guarda tal cual venía: así vuelven al
            // archivo las coordenadas de posición (X1, X2, Y1, Y2) y el
            // espaciado de quien lo escribió.
            timecodes,
            startTimeMs,
            endTimeMs,
            durationMs,
            original: texto,
            translation: '',
            wordCountOriginal: countWords(texto),
            wordCountTranslation: 0,
            isTranslated: false,
            charCountOriginal: countCharactersWithoutTags(texto),
            charCountTranslation: 0,
            cpsOriginal: calculateCPS(texto, durationMs),
            cpsTranslation: 0,
        });
    }

    return subtitulos;
}

/**
 * Deja el texto del editor en lo que un subtítulo admite.
 *
 * El editor es un campo de HTML, y el navegador escribe ahí lo que le parece:
 * un salto de línea puede acabar siendo un <br>, un <div> o un salto de verdad,
 * y una cursiva puede salir como <i>, como <em> o como un <span> con estilo,
 * según el navegador y según cómo se haya escrito. Un reproductor de subtítulos
 * entiende <i> y <b> y poco más.
 *
 * Aquí se normaliza todo eso a una sola forma: saltos de línea de verdad y
 * <i>/<b>. Lo usan tanto la exportación como la vista previa sobre el vídeo,
 * que es lo que garantiza que lo que se ve al traducir sea lo que sale en el
 * archivo.
 *
 * @param {string} texto
 * @param {string[]} [permitidas] Las etiquetas que el formato admite. Las de
 *   partida son las del SRT; WebVTT añade las suyas (<v>, <c>, <ruby>…), que
 *   son parte del formato y las pone quien maqueta.
 * @returns {string} Texto con saltos de línea y solo las etiquetas permitidas.
 */
/**
 * Las etiquetas que admite un SRT: cursiva, negrita, subrayado y color.
 *
 * Son las que entienden los reproductores. Todo lo demás que aparezca en el
 * campo del editor lo ha puesto el navegador y no pinta nada en el archivo.
 */
export const ETIQUETAS_DE_SRT = ['b', 'i', 'u', 'font'];

export function limpiarParaSubtitulo(texto, permitidas = ETIQUETAS_DE_SRT) {
    let limpio = texto ?? '';

    // Los saltos, en todas sus formas.
    limpio = limpio.replace(/<\/div>\s*<div[^>]*>/gi, '\n');
    limpio = limpio.replace(/<div[^>]*>/gi, '\n').replace(/<\/div>/gi, '');
    limpio = limpio.replace(/<br\s*\/?>/gi, '\n');
    limpio = limpio.replace(/<\/p>\s*<p[^>]*>/gi, '\n');
    limpio = limpio.replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '');

    // <em> y <strong> significan lo mismo que <i> y <b>, pero no todos los
    // reproductores los entienden.
    limpio = limpio.replace(/<em(\s[^>]*)?>/gi, '<i>').replace(/<\/em>/gi, '</i>');
    limpio = limpio.replace(/<strong(\s[^>]*)?>/gi, '<b>').replace(/<\/strong>/gi, '</b>');

    // Y el <span> con estilo, que es lo que deja el navegador cuando trabaja
    // con estilos en vez de etiquetas. Sin esto, poner una palabra en cursiva
    // se veía bien en el editor y salía sin cursiva en el archivo.
    limpio = limpio.replace(
        /<span[^>]*font-style:\s*italic[^>]*>([\s\S]*?)<\/span>/gi,
        '<i>$1</i>',
    );
    limpio = limpio.replace(
        /<span[^>]*font-weight:\s*(?:bold|[6-9]00)[^>]*>([\s\S]*?)<\/span>/gi,
        '<b>$1</b>',
    );
    // Y el color, que el navegador escribe unas veces como <font color> y otras
    // como un estilo en línea, según por dónde se le pida. Sin esto, pintar una
    // palabra de amarillo se veía en el editor y salía en blanco en el archivo.
    limpio = limpio.replace(
        /<span[^>]*[^-]color:\s*([^;"']+)[^>]*>([\s\S]*?)<\/span>/gi,
        // El color se normaliza a #rrggbb: el navegador lo escribe unas veces
        // así y otras como rgb(0, 255, 255), y un rgb() dentro de un SRT no lo
        // entiende casi ningún reproductor. Si no se reconoce se deja como
        // estaba, que lo habrá puesto alguien a propósito.
        (entero, color, dentro) =>
            `<font color="${comoLoEntiendeUnArchivo(color)}">${dentro}</font>`,
    );

    // Todo lo demás fuera. Se quedan las cuatro que el formato admite y que los
    // reproductores entienden: cursiva, negrita, subrayado y color. El resto es
    // del editor y no pinta nada en un archivo de subtítulos.
    // El `(?:\.[^\s<>]+)*` es por WebVTT, donde la clase de estilo va pegada al
    // nombre con un punto: <c.grito>, <v.fuerte Ana>. Sin eso se colaba por la
    // rendija y se perdía justo la etiqueta que decía cómo se ve el subtítulo.
    const guardadas = permitidas.join('|');
    limpio = limpio.replace(
        new RegExp(`<(?!/?(?:${guardadas})(?:\\.[^\\s<>]+)*(?:\\s[^<>]*)?/?>)[^<>]*>`, 'gi'),
        '',
    );

    // Y ahora las entidades, no antes: el campo del editor guarda "&" como
    // "&amp;" y "<" como "&lt;", y escribir eso en el archivo es escribir
    // literalmente "&amp;" encima de la cara de alguien. Se hace después de
    // quitar las etiquetas para que un "&lt;script&gt;" escrito a mano no se
    // convierta en una etiqueta de verdad justo a tiempo de colarse.
    limpio = limpio
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#0?39;|&apos;/gi, "'")
        // El ampersand, el último: si no, "&amp;lt;" acabaría siendo "<".
        .replace(/&amp;/gi, '&');

    return limpio.trim();
}

/**
 * El texto de un subtítulo listo para verse encima del vídeo.
 *
 * Es lo mismo que se va a escribir en el archivo, con los saltos convertidos a
 * <br> para que el navegador los pinte. Así la vista previa enseña exactamente
 * lo que va a salir, y no lo que el editor tenga guardado por dentro.
 *
 * @param {string} texto
 * @returns {string} HTML.
 */
export function paraLaVistaPrevia(texto, permitidas = ETIQUETAS_DE_SRT) {
    return limpiarParaSubtitulo(texto, permitidas).replace(/\n/g, '<br>');
}

/**
 * Cuánto se parecen los tiempos de dos listas de subtítulos.
 *
 * Al importar una traducción ya hecha, los subtítulos se emparejan por posición:
 * el primero con el primero, el segundo con el segundo. Si el archivo traducido
 * es de otro montaje —una versión con otro corte, o el mismo capítulo de otra
 * plataforma—, puede tener el mismo número de subtítulos y aun así emparejar mal
 * de arriba abajo. Y una traducción corrida un subtítulo no se ve al revisar:
 * cada línea es correcta, solo que va donde no le toca.
 *
 * Comparar los tiempos de entrada lo dice enseguida: si son el mismo archivo,
 * coinciden casi todos.
 *
 * @param {Array<{startTimeMs: number}>} unos
 * @param {Array<{startTimeMs: number}>} otros
 * @param {number} [tolerancia] Milisegundos de margen.
 * @returns {number} De 0 a 1.
 */
export function cuantoCuadranLosTiempos(unos, otros, tolerancia = 100) {
    const cuantos = Math.min(unos.length, otros.length);
    if (cuantos === 0) return 0;

    let cuadran = 0;
    for (let i = 0; i < cuantos; i++) {
        if (Math.abs(unos[i].startTimeMs - otros[i].startTimeMs) <= tolerancia) cuadran += 1;
    }
    return cuadran / cuantos;
}

/**
 * Escribe el SRT traducido.
 *
 * Donde no hay traducción va el original **tal cual venía**, sin pasarlo por el
 * limpiador: ese texto no lo ha escrito esta herramienta, lo trajo el archivo, y
 * devolverlo cambiado —aunque sea para mejor— rompe la promesa de que abrir y
 * guardar sin traducir devuelve el mismo archivo.
 *
 * @param {Array<Object>} subtitulos
 * @param {{saltoDeLinea?: string, terminaConSalto?: boolean}} [formato]
 *   Cómo estaba escrito el archivo que se abrió; lo da detectarFormatoSrt.
 * @returns {string}
 */
export function reconstructSrt(subtitulos, formato = {}) {
    return escribirBloques(
        subtitulos,
        (s) => (String(s.translation || '').trim() ? limpiarParaSubtitulo(s.translation) : s.original),
        formato,
    );
}

/**
 * Escribe el SRT original, sin las traducciones.
 *
 * Sirve para recuperar el archivo de partida de una copia de seguridad.
 */
export function reconstructOriginalSrt(subtitulos, formato = {}) {
    return escribirBloques(subtitulos, (s) => s.original, formato);
}

/**
 * El armazón de los dos: número, tiempos y texto, separados por una línea en
 * blanco, con los saltos de línea del archivo de partida.
 *
 * @param {Array<Object>} subtitulos
 * @param {(subtitulo: Object) => string} textoDe
 * @param {{saltoDeLinea?: string, terminaConSalto?: boolean}} formato
 * @returns {string}
 */
function escribirBloques(subtitulos, textoDe, { saltoDeLinea = '\n', terminaConSalto = true } = {}) {
    const bloques = subtitulos.map((subtitulo) => {
        const texto = String(textoDe(subtitulo) ?? '').replace(/\r?\n/g, saltoDeLinea);
        return [subtitulo.index, subtitulo.timecodes, texto].join(saltoDeLinea);
    });

    const contenido = bloques.join(saltoDeLinea + saltoDeLinea);
    return contenido && terminaConSalto ? contenido + saltoDeLinea : contenido;
}
