/**
 * TTML, y sus primos DFXP e IMSC: los subtítulos de las plataformas grandes y
 * de la televisión.
 *
 * Es el formato que hay que hablar para trabajar con las plataformas grandes, y
 * el más rico de los tres que abre subpandaTM. Un archivo trae, además de los
 * subtítulos, todo el trabajo de quien lo maquetó: los estilos, las regiones de
 * pantalla, la base de tiempos, los fotogramas por segundo y a veces metadatos
 * del encargo. Nada de eso se traduce y todo eso tiene que volver.
 *
 * POR QUÉ NO SE USA EL ANALIZADOR DEL NAVEGADOR
 *
 * Porque de un árbol solo se puede volver a un archivo escribiéndolo entero, y
 * al escribirlo entero cambian la sangría, el orden de los atributos, la forma
 * de las etiquetas vacías y los comentarios desaparecen. Un control de calidad
 * de plataforma mira esas cosas. Así que se hace como en Poanda: se anota en qué
 * posición exacta del archivo empieza y acaba cada texto y, al guardar, se
 * sustituyen solo esas posiciones. Lo demás no vuelve intacto porque se copie:
 * vuelve intacto porque no se ha tocado.
 *
 * LO QUE SE TRADUCE
 *
 * Cada `<p>` del cuerpo, con su marcado de dentro incluido:
 *
 *     <p begin="00:00:01.000" end="00:00:03.000" region="abajo">
 *       Hola <span tts:fontStyle="italic">otra vez</span><br/>segunda línea
 *     </p>
 *
 * El `<span>` y el `<br/>` viajan dentro del segmento, como etiquetas, igual que
 * en cualquier herramienta TAO. Traducir "Hola", "otra vez" y "segunda línea"
 * por separado es como salen las traducciones raras.
 */
import { comoLoEntiendeUnArchivo } from './color.js';
import {
    calculateCPS,
    countCharactersWithoutTags,
    countWords,
    formatTime,
    limpiarParaSubtitulo,
} from './srt.js';
import { atributo, buscarElementos, escaparDejandoEtiquetas } from './xml.js';
import { sustituirTramos } from './tramos.js';

/**
 * Las etiquetas que TTML admite dentro de un subtítulo.
 *
 * Son dos: `span`, que es la que lleva el estilo, y `br`, el salto de línea. No
 * hay `<i>` ni `<b>` ni `<u>`; en TTML la cursiva es un atributo del `<span>`.
 * Las cuatro del SRT se dejan pasar hasta el último momento porque son lo que
 * escribe el campo del editor, y justo antes de guardar se traducen a `<span>`
 * (ver `comoLoEscribeElFormato`). Un `<i>` dentro de un TTML es un archivo que
 * el control de calidad de una plataforma devuelve.
 */
export const ETIQUETAS_DE_TTML = ['span', 'b', 'i', 'u', 'font'];

/**
 * La misma idea escrita de dos maneras: como la escribe el editor y como la
 * escribe el formato.
 *
 * Sirve para las dos direcciones. Al guardar, la cursiva que puso quien traduce
 * se escribe como la escribe TTML; al abrir, el `<span>` del archivo se enseña
 * en el editor con la pinta que va a tener en pantalla, que es de lo que va un
 * editor de subtítulos.
 */
const ESTILOS = [
    { etiqueta: 'i', atributo: 'tts:fontStyle', valor: 'italic', css: 'font-style:italic' },
    { etiqueta: 'b', atributo: 'tts:fontWeight', valor: 'bold', css: 'font-weight:bold' },
    {
        etiqueta: 'u',
        atributo: 'tts:textDecoration',
        valor: 'underline',
        css: 'text-decoration:underline',
    },
];

/**
 * Pasa a `<span>` las etiquetas de estilo que escribe el editor.
 *
 * @param {string} texto
 * @returns {string}
 */
function comoLoEscribeElFormato(texto) {
    let salida = String(texto ?? '');

    for (const estilo of ESTILOS) {
        salida = salida
            .replace(
                new RegExp(`<${estilo.etiqueta}(?:\\s[^<>]*)?>`, 'gi'),
                `<span ${estilo.atributo}="${estilo.valor}">`,
            )
            .replace(new RegExp(`</${estilo.etiqueta}\\s*>`, 'gi'), '</span>');
    }

    // El color lo escribe el navegador como <font color="…">, que tampoco es de
    // este formato.
    salida = salida
        .replace(
            /<font[^<>]*\bcolor\s*=\s*["']([^"']*)["'][^<>]*>/gi,
            (entero, valor) => `<span tts:color="${comoLoEntiendeUnArchivo(valor)}">`,
        )
        .replace(/<font(?:\s[^<>]*)?>/gi, '<span>')
        .replace(/<\/font\s*>/gi, '</span>');

    return salida;
}

/**
 * El texto de un subtítulo con la pinta que va a tener en pantalla.
 *
 * Un `<span tts:fontStyle="italic">` es una cursiva, pero el navegador no lo
 * sabe: pintado tal cual sale texto normal, y quien traduce no ve que esa
 * palabra va en cursiva. Aquí se le añade el estilo equivalente, solo para
 * verlo. El texto del archivo no se toca.
 *
 * @param {string} texto
 * @returns {string} HTML para pintar en el editor.
 */
export function paraVerElTtml(texto) {
    return String(texto ?? '').replace(/<span(\s[^<>]*)>/gi, (entero, atributos) => {
        const css = ESTILOS.filter(
            (estilo) => (atributo(atributos, estilo.atributo) || '').toLowerCase() === estilo.valor,
        ).map((estilo) => estilo.css);

        const color = atributo(atributos, 'tts:color');
        if (color) css.push(`color:${color}`);

        return css.length ? `<span${atributos} style="${css.join(';')}">` : entero;
    });
}

/**
 * ¿Es esto un TTML?
 *
 * Se mira que haya un elemento raíz `<tt>`, que es lo que tienen los tres
 * dialectos. La extensión no basta: un .xml puede ser cualquier cosa y un .dfxp
 * es un TTML con otro nombre.
 *
 * @param {string} contenido
 * @returns {boolean}
 */
export function esTtml(contenido) {
    return /<(?:[\w.-]+:)?tt[\s>]/.test(String(contenido ?? ''));
}

/**
 * Un tiempo de TTML a milisegundos.
 *
 * El formato admite cuatro maneras de escribir un tiempo, y por ahí circulan las
 * cuatro:
 *
 * - De reloj: `00:00:01.500`.
 * - De reloj con fotogramas: `00:00:01:12` (hace falta saber los fps).
 * - Con unidad: `1.5s`, `100ms`, `2m`, `1h`, `36f` (fotogramas), `500t` (tics).
 * - Sin nada: se leen como segundos.
 *
 * @param {string|null} valor
 * @param {{fps?: number, tics?: number}} [reloj]
 * @returns {number} Milisegundos, o NaN si ahí no hay un tiempo.
 */
export function tiempoTtmlAMs(valor, { fps = 25, tics = 1 } = {}) {
    const texto = String(valor ?? '').trim();
    if (!texto) return NaN;

    const conFotogramas = texto.match(/^(\d+):(\d{2}):(\d{2}):(\d{1,3})$/);
    if (conFotogramas) {
        const [, h, m, s, f] = conFotogramas.map(Number);
        return ((h * 60 + m) * 60 + s) * 1000 + Math.round((f / fps) * 1000);
    }

    const deReloj = texto.match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
    if (deReloj) {
        const [, h, m, s] = deReloj;
        return Math.round((Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000);
    }

    const conUnidad = texto.match(/^(\d+(?:\.\d+)?)(h|m|s|ms|f|t)?$/);
    if (conUnidad) {
        const cantidad = Number(conUnidad[1]);
        switch (conUnidad[2]) {
            case 'h':
                return Math.round(cantidad * 3600000);
            case 'm':
                return Math.round(cantidad * 60000);
            case 'ms':
                return Math.round(cantidad);
            case 'f':
                return Math.round((cantidad / fps) * 1000);
            case 't':
                return Math.round((cantidad / tics) * 1000);
            default:
                return Math.round(cantidad * 1000);
        }
    }

    return NaN;
}

/**
 * Milisegundos a tiempo de TTML, escrito como el archivo escribe los suyos.
 *
 * Si el archivo usa fotogramas se le devuelven fotogramas, y si usa segundos con
 * unidad se le devuelven segundos con unidad. Cambiarle la notación a un archivo
 * porque se ha tocado un tiempo es devolverlo distinto de como vino.
 *
 * @param {number} ms
 * @param {string} comoElOriginal Un tiempo del archivo, para copiarle la forma.
 * @param {{fps?: number}} [reloj]
 * @returns {string}
 */
export function msATiempoTtml(ms, comoElOriginal = '', { fps = 25 } = {}) {
    const original = String(comoElOriginal).trim();

    if (/^\d+:\d{2}:\d{2}:\d{1,3}$/.test(original)) {
        const totalSegundos = Math.floor(ms / 1000);
        const fotogramas = Math.round(((ms % 1000) / 1000) * fps);
        const dosCifras = (n) => String(n).padStart(2, '0');
        return [
            dosCifras(Math.floor(totalSegundos / 3600)),
            dosCifras(Math.floor((totalSegundos % 3600) / 60)),
            dosCifras(totalSegundos % 60),
            dosCifras(fotogramas),
        ].join(':');
    }

    if (/^\d+(\.\d+)?ms$/.test(original)) return `${Math.round(ms)}ms`;
    if (/^\d+(\.\d+)?s$/.test(original)) return `${(ms / 1000).toFixed(3)}s`;

    // Lo demás, de reloj: es lo que usan casi todos y lo que manda el perfil de
    // las plataformas. formatTime escribe con coma, que es del SRT; el TTML usa
    // punto.
    return formatTime(ms).replace(',', '.');
}

/**
 * Deshace las entidades de un texto, menos las de los ángulos.
 *
 * Quien traduce tiene que ver "Tom & Jerry" y no "Tom &amp; Jerry": esa cadena
 * es la que va a la memoria de traducción y a la IA, y si va con la entidad
 * dentro, la traducción vuelve con la entidad dentro.
 *
 * Los ángulos se quedan escapados a propósito. Un "&lt;i&gt;" del archivo es
 * texto que se ve en pantalla, no una cursiva; deshacerlo lo convertiría en una
 * etiqueta de verdad justo a tiempo de colarse en el archivo de salida.
 *
 * @param {string} texto
 * @returns {string}
 */
function deshacerEntidades(texto) {
    const salvoAngulos = (caracter, entero) => (caracter === '<' || caracter === '>' ? entero : caracter);

    return String(texto ?? '')
        .replace(/&#x([0-9a-f]+);/gi, (entero, hex) =>
            salvoAngulos(String.fromCodePoint(parseInt(hex, 16)), entero),
        )
        .replace(/&#(\d+);/g, (entero, num) =>
            salvoAngulos(String.fromCodePoint(parseInt(num, 10)), entero),
        )
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        // El & va el último: si fuera el primero, "&amp;lt;" acabaría siendo
        // "&lt;" y luego "<".
        .replace(/&amp;/g, '&');
}

/**
 * El texto de un párrafo, tal como se va a ver en pantalla.
 *
 * Aquí está la diferencia entre el archivo y el subtítulo. Un TTML se escribe
 * con sangría, para que se pueda leer:
 *
 *     <p begin="5s" end="10s">
 *       that the image formed on<br/>
 *       the Retina should be inverted?
 *     </p>
 *
 * Esos saltos de línea y esos espacios son del archivo, no del subtítulo: XML
 * los junta en un espacio y no se ven. Lo único que parte una línea de otra es
 * el `<br/>`. Tomárselos al pie de la letra es lo que metía una línea vacía en
 * medio y ocho espacios delante de la segunda.
 *
 * La excepción es `xml:space="preserve"`, que es la manera que tiene el formato
 * de decir "esto está escrito así a propósito". Entonces no se toca nada.
 *
 * @param {string} contenido Lo que hay dentro del `<p>`, tal cual.
 * @param {boolean} preservar Si el archivo pidió que se respeten los espacios.
 * @returns {string}
 */
function textoDelParrafo(contenido, preservar) {
    const conSaltos = String(contenido ?? '').replace(/<br\s*\/?>/gi, '\n');
    if (preservar) return conSaltos.trim();

    // Se junta el espacio sobrante solo en el texto: dentro de una etiqueta hay
    // atributos, y ahí un espacio de más o de menos no es cosa nuestra.
    return conSaltos
        .split(/(<[^<>]*>)/)
        .map((trozo, i) =>
            i % 2 === 1
                ? trozo
                : trozo.replace(/[^\S\n]*\n[\s]*/g, '\n').replace(/[^\S\n]+/g, ' '),
        )
        .join('')
        .trim();
}

/**
 * Lee un TTML.
 *
 * @param {string} contenido
 * @returns {{entradas: Array<Object>, documento: Object}}
 */
export function parseTtmlContent(contenido) {
    const texto = String(contenido ?? '');

    // La base de tiempos del archivo, que hace falta para leer los tiempos en
    // fotogramas y en tics.
    const raiz = texto.match(/<(?:[\w.-]+:)?tt(\s[^>]*)?>/);
    const atributosDeLaRaiz = raiz?.[1] || '';
    const reloj = {
        fps: Number(atributo(atributosDeLaRaiz, 'ttp:frameRate') || atributo(atributosDeLaRaiz, 'frameRate')) || 25,
        tics: Number(atributo(atributosDeLaRaiz, 'ttp:tickRate') || atributo(atributosDeLaRaiz, 'tickRate')) || 1,
    };

    // Si el documento entero pide que se respeten los espacios, se respetan.
    const espacioDelDocumento = atributo(atributosDeLaRaiz, 'xml:space') === 'preserve';

    // Solo los párrafos del cuerpo: en la cabecera puede haber metadatos con
    // texto que no se traduce.
    const cuerpo = buscarElementos(texto, 'body')[0];
    const desde = cuerpo ? cuerpo.contenidoInicio : 0;
    const hasta = cuerpo ? cuerpo.contenidoFin : texto.length;

    const entradas = [];
    const parrafos = [];

    for (const parrafo of buscarElementos(texto, 'p', desde, hasta)) {
        const begin = atributo(parrafo.atributos, 'begin');
        const end = atributo(parrafo.atributos, 'end');
        const dur = atributo(parrafo.atributos, 'dur');

        const startTimeMs = tiempoTtmlAMs(begin, reloj) || 0;
        const conDuracion = tiempoTtmlAMs(dur, reloj);
        const endTimeMs = end
            ? tiempoTtmlAMs(end, reloj)
            : startTimeMs + (Number.isNaN(conDuracion) ? 0 : conDuracion);
        const durationMs = Math.max(0, endTimeMs - startTimeMs);

        // El marcado de dentro se queda: es parte del segmento, como en
        // cualquier herramienta TAO. El <br/> sí se pasa a salto de línea, para
        // que el editor cuente las líneas y los caracteres por línea como en
        // cualquier otro formato.
        const preservar =
            atributo(parrafo.atributos, 'xml:space') === 'preserve' || espacioDelDocumento;
        const original = deshacerEntidades(textoDelParrafo(parrafo.contenido, preservar));

        parrafos.push({
            inicio: parrafo.inicio,
            fin: parrafo.fin,
            contenidoInicio: parrafo.contenidoInicio,
            contenidoFin: parrafo.contenidoFin,
            atributos: parrafo.atributos,
            begin: begin || '',
            end: end || '',
            dur: dur || '',
            // Con qué se abrió el párrafo, para saber al guardar si algo ha
            // cambiado. Si nada ha cambiado no se toca, y por eso un archivo
            // abierto y guardado sin traducir vuelve byte a byte.
            contenidoOriginal: original,
            startTimeMs,
            endTimeMs,
        });

        entradas.push({
            index: entradas.length + 1,
            // Un enlace al párrafo del que salió. Es lo que permite partir y
            // fusionar subtítulos sin perder de vista a qué trozo del archivo
            // corresponde cada uno.
            parrafo: parrafos.length - 1,
            timecodes: `${formatTime(startTimeMs)} --> ${formatTime(endTimeMs)}`,
            startTimeMs,
            endTimeMs,
            durationMs,
            original,
            translation: '',
            wordCountOriginal: countWords(original),
            wordCountTranslation: 0,
            isTranslated: false,
            charCountOriginal: countCharactersWithoutTags(original),
            charCountTranslation: 0,
            cpsOriginal: calculateCPS(original, durationMs),
            cpsTranslation: 0,
        });
    }

    return { entradas, documento: { texto, parrafos, reloj } };
}

/**
 * Vuelve a escribir el archivo.
 *
 * Se sustituyen solo los trozos que han cambiado. Cada párrafo del archivo se
 * rehace con los subtítulos que apuntan a él, que normalmente es uno: si se
 * partió en dos, salen dos `<p>` con los mismos atributos y sus tiempos; si se
 * fusionó con el siguiente, el párrafo del siguiente se queda sin subtítulos y
 * desaparece del archivo.
 *
 * @param {Array<Object>} entradas
 * @param {Object} documento
 * @returns {string}
 */
export function reconstructTtml(entradas, documento) {
    const texto = documento?.texto;
    if (!texto) return '';

    const parrafos = documento.parrafos || [];
    const reloj = documento.reloj || { fps: 25, tics: 1 };

    // Qué subtítulos ha acabado teniendo cada párrafo.
    const porParrafo = parrafos.map(() => []);
    for (const entrada of entradas) {
        const cual = entrada.parrafo;
        if (Number.isInteger(cual) && porParrafo[cual]) porParrafo[cual].push(entrada);
    }

    const tramos = [];

    parrafos.forEach((parrafo, i) => {
        const suyos = porParrafo[i];

        // Sin subtítulos: se ha borrado o se ha fusionado con el anterior.
        if (suyos.length === 0) {
            tramos.push({ inicio: parrafo.inicio, fin: parrafo.fin, texto: '' });
            return;
        }

        // El caso normal: un subtítulo, un párrafo. Solo se toca lo que ha
        // cambiado —el texto, y los tiempos si se han movido—, para no reescribir
        // una etiqueta de apertura que estaba bien.
        if (suyos.length === 1) {
            const entrada = suyos[0];
            const contenido = textoDe(entrada);
            if (contenido !== escribirTexto(parrafo.contenidoOriginal)) {
                tramos.push({
                    inicio: parrafo.contenidoInicio,
                    fin: parrafo.contenidoFin,
                    texto: contenido,
                });
            }
            const apertura = aperturaDe(entrada, parrafo, reloj);
            if (apertura !== null) {
                tramos.push({
                    inicio: parrafo.inicio,
                    fin: parrafo.contenidoInicio,
                    texto: apertura,
                });
            }
            return;
        }

        // Varios: el párrafo se partió. Se escriben tantos <p> como haga falta,
        // todos con los atributos del original y cada uno con sus tiempos.
        const nuevos = suyos
            .map((entrada) => {
                const abre = aperturaDe(entrada, parrafo, reloj, true);
                return `${abre}${textoDe(entrada)}${cierreDe(texto, parrafo)}`;
            })
            .join('\n');
        tramos.push({ inicio: parrafo.inicio, fin: parrafo.fin, texto: nuevos });
    });

    return conLaCodificacionAlDia(sustituirTramos(texto, tramos));
}

/**
 * Pone al día la codificación que declara el archivo.
 *
 * subpandaTM guarda siempre en UTF-8, que es lo que piden los tres dialectos.
 * Si el archivo de partida venía declarando otra cosa —hay TTML antiguos que
 * dicen windows-1252— y se devolviera esa línea tal cual, el archivo diría de sí
 * mismo algo que no es cierto y el primer acento lo abriría roto. Es el único
 * sitio donde se toca algo que nadie ha traducido, y se toca porque la
 * alternativa es entregar un archivo que miente sobre sí mismo.
 */
function conLaCodificacionAlDia(texto) {
    return texto.replace(
        /^(<\?xml[^?>]*?encoding\s*=\s*)("[^"]*"|'[^']*')/i,
        (entero, antes, valor) =>
            /^["']utf-?8["']$/i.test(valor) ? entero : `${antes}"utf-8"`,
    );
}

/** El contenido de un párrafo: la traducción si la hay, y si no el original. */
function textoDe(entrada) {
    const traduccion = String(entrada.translation || '').trim();

    // De la traducción hay que quitar antes lo que deja el campo del editor:
    // <div> por cada salto, <span style="font-style:italic"> por cada cursiva.
    // Eso es del navegador y no pinta nada en un archivo de subtítulos.
    return escribirTexto(
        traduccion
            ? comoLoEscribeElFormato(limpiarParaSubtitulo(traduccion, ETIQUETAS_DE_TTML))
            : String(entrada.original ?? ''),
    );
}

/**
 * Un texto del editor, listo para meterlo dentro de un `<p>`.
 *
 * Los saltos de línea vuelven a ser `<br/>`, que es como se escriben aquí, y se
 * escapa lo que hay que escapar dejando en pie las etiquetas: quien traduce ve
 * el `<span>` del original y tiene que poder llevárselo consigo. Un "&" o un "<"
 * sueltos sin escapar dejan el archivo sin abrir.
 */
function escribirTexto(texto) {
    return escaparDejandoEtiquetas(String(texto ?? '').replace(/\n/g, '<br/>'));
}

/**
 * La etiqueta de apertura, con los tiempos al día.
 *
 * Devuelve null cuando no hay nada que cambiar, para no tocar una etiqueta que
 * estaba bien: es la diferencia entre un archivo devuelto y un archivo
 * reescrito. Y se mira si el tiempo ha cambiado comparando milisegundos, no
 * cómo está escrito: un párrafo con begin="4.5s" al que nadie ha tocado no tiene
 * por qué salir con begin="4.500s".
 */
function aperturaDe(entrada, parrafo, reloj, siempre = false) {
    const cambiaElPrincipio = entrada.startTimeMs !== parrafo.startTimeMs;
    const cambiaElFinal = entrada.endTimeMs !== parrafo.endTimeMs;
    if (!cambiaElPrincipio && !cambiaElFinal && !siempre) return null;

    let atributos = parrafo.atributos;

    if (cambiaElPrincipio || siempre) {
        atributos = ponerAtributo(atributos, 'begin', msATiempoTtml(entrada.startTimeMs, parrafo.begin, reloj));
    }

    if (cambiaElFinal || siempre) {
        // Un párrafo puede decir cuándo acaba o cuánto dura. Se le contesta en
        // lo que preguntó: cambiarle el "dur" por un "end" es devolverle un
        // archivo distinto del que mandó.
        if (parrafo.dur && !parrafo.end) {
            const duracion = Math.max(0, entrada.endTimeMs - entrada.startTimeMs);
            atributos = ponerAtributo(atributos, 'dur', msATiempoTtml(duracion, parrafo.dur, reloj));
        } else {
            atributos = ponerAtributo(
                atributos,
                'end',
                msATiempoTtml(entrada.endTimeMs, parrafo.end || parrafo.begin, reloj),
            );
        }
    }

    return `<p${atributos}>`;
}

/** Cambia el valor de un atributo dentro de la parte de dentro de una etiqueta. */
function ponerAtributo(atributos, nombre, valor) {
    const busca = new RegExp(`(\\b${nombre}\\s*=\\s*)("[^"]*"|'[^']*')`, 'i');
    if (busca.test(atributos)) return atributos.replace(busca, `$1"${valor}"`);
    return `${atributos} ${nombre}="${valor}"`;
}

/** El cierre del párrafo, tal como lo escribe el archivo. */
function cierreDe(texto, parrafo) {
    return texto.slice(parrafo.contenidoFin, parrafo.fin);
}
