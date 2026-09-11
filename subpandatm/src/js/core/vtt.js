/**
 * WebVTT: el formato de los subtítulos en la web.
 *
 * Es el de casi todo lo que se ve por streaming, y por fuera se parece al SRT:
 * una lista de subtítulos con sus tiempos. Por dentro lleva cosas que el SRT no
 * tiene y que no son adorno —dónde va el subtítulo en pantalla, quién habla, los
 * estilos del documento, las regiones— y que las pone alguien cobrando por
 * ponerlas.
 *
 * DE AHÍ CÓMO ESTÁ ESCRITO ESTO
 *
 * El archivo se parte en piezas y solo se abren las que se traducen. Todo lo
 * demás —la cabecera, los comentarios, los bloques STYLE y REGION, y cualquier
 * cosa que aparezca mañana en el formato y que aquí no se conozca— se guarda tal
 * cual y vuelve al archivo intacta. Es la misma regla con la que Poanda abre sus
 * veintitantos formatos: **se reconstruye sobre el archivo que se abrió, no se
 * escribe uno nuevo**. La diferencia entre "guardar" y "rehacer el archivo con
 * lo que he entendido de él".
 *
 * Un subtítulo de WebVTT son hasta tres partes:
 *
 *     saludo                                        ← el nombre, opcional
 *     00:00:01.000 --> 00:00:03.000 align:start     ← tiempos y ajustes
 *     <v Ana>Hola                                   ← el texto
 *
 * Los ajustes van pegados a la línea de tiempos y se guardan con ella, enteros,
 * por la misma razón que en el SRT se guardan las coordenadas de posición: los
 * puso alguien y tienen que volver.
 */
import { aHex } from './color.js';
import {
    calculateCPS,
    countCharactersWithoutTags,
    countWords,
    limpiarParaSubtitulo,
    paraLaVistaPrevia,
    parseTime,
} from './srt.js';

/**
 * Las etiquetas que se dejan pasar al limpiar lo que viene del editor.
 *
 * Del formato son todas menos una: `c` para las clases de estilo, `v` para
 * decir quién habla, `lang` para un trozo en otro idioma y `ruby`/`rt` para las
 * anotaciones del japonés, además de la negrita, la cursiva y el subrayado.
 *
 * `font` no es de WebVTT y no llega al archivo: está aquí porque es como el
 * navegador deja el color, y se cambia por la clase que le toca justo antes de
 * escribir (ver `comoLoEscribeElVtt`). Si se quitara de esta lista, el color se
 * perdería en la limpieza y no habría nada que convertir.
 */
export const ETIQUETAS_DE_VTT = ['b', 'i', 'u', 'font', 'c', 'v', 'lang', 'ruby', 'rt'];

/**
 * Los ocho colores que WebVTT trae de serie.
 *
 * En WebVTT el color no es una etiqueta sino una clase: `<c.yellow>`. Estos
 * ocho vienen definidos en el propio formato, así que un reproductor los pinta
 * sin que el archivo tenga que explicar nada. Son los mismos de los subtítulos
 * de televisión de siempre, que es de donde salen.
 *
 * Cualquier otro color hay que declararlo en un bloque STYLE de la cabecera
 * (ver `bloqueDeEstilos`). Por eso, cuando el color elegido es exactamente uno
 * de estos ocho, se usa su nombre: es lo que más reproductores entienden.
 */
const COLORES_CON_NOMBRE = {
    '#ffffff': 'white',
    '#00ff00': 'lime',
    '#00ffff': 'cyan',
    '#ff0000': 'red',
    '#ffff00': 'yellow',
    '#ff00ff': 'magenta',
    '#0000ff': 'blue',
    '#000000': 'black',
};

/** Al revés, para poder pintar en el editor lo que dice el archivo. */
const NOMBRE_A_COLOR = Object.fromEntries(
    Object.entries(COLORES_CON_NOMBRE).map(([hex, nombre]) => [nombre, hex]),
);

/**
 * Cómo se llama la clase de un color que no es de los ocho.
 *
 * El nombre lleva el color dentro para que dos subtítulos del mismo color
 * compartan una sola regla, y para que al volver a guardar se reconozca sola
 * sin tener que acordarse de nada.
 */
const claseDeColor = (hex) => `color-${hex.slice(1)}`;

/** La marca que distingue el bloque STYLE que escribe subpandaTM del que traía el archivo. */
const MARCA = '/* subpandaTM */';

/** La línea que separa los tiempos del resto. */
const FLECHA = /-->/;

/**
 * Dónde sale el subtítulo, en las nueve casillas del teclado numérico.
 *
 * En WebVTT la posición no va en el texto sino en la propia línea de tiempos,
 * detrás de los tiempos: `line:` dice a qué altura y `align:` a qué lado. Es
 * otro sitio distinto que en ASS, donde es una marca dentro del texto, pero
 * para quien traduce es el mismo botón y las mismas nueve casillas.
 *
 * De las nueve, la de abajo en el centro es la de siempre y no se escribe: es
 * lo que hace un reproductor cuando no se le dice nada, y ponerlo sería
 * ensuciar el archivo para pedir lo que ya iba a pasar.
 */
const ALTURAS = { 7: 'line:0%', 8: 'line:0%', 9: 'line:0%', 4: 'line:50%', 5: 'line:50%', 6: 'line:50%' };
const LADOS = { 7: 'align:start', 4: 'align:start', 1: 'align:start', 9: 'align:end', 6: 'align:end', 3: 'align:end' };

/** Los ajustes que pone y quita esto. Los demás que traiga la línea no se tocan. */
const AJUSTES_DE_SITIO = /\s*\b(?:line|align):[^\s]+/g;

/**
 * La línea de tiempos con el subtítulo puesto en otro sitio.
 *
 * @param {string} timecodes La línea entera, con sus ajustes.
 * @param {string|number} numero Del 1 al 9, como el teclado numérico. Vacío
 *   para quitar la posición y dejar la de siempre.
 * @returns {string} La línea nueva.
 */
export function conLaPosicion(timecodes, numero) {
    // Se quitan los dos que maneja esto y se vuelven a poner al final. Los
    // demás —region, size, vertical, position— son del archivo y se quedan
    // donde estaban.
    const limpia = String(timecodes ?? '').replace(AJUSTES_DE_SITIO, '').replace(/\s+$/, '');
    const cual = String(numero ?? '');
    const puestos = [ALTURAS[cual], LADOS[cual]].filter(Boolean);
    return puestos.length ? `${limpia} ${puestos.join(' ')}` : limpia;
}

/**
 * En qué casilla está puesto ahora, para que el selector lo enseñe.
 *
 * @param {string} timecodes
 * @returns {string} Del 1 al 9, o cadena vacía si va donde siempre.
 */
export function posicionDe(timecodes) {
    const linea = String(timecodes ?? '');
    const altura = linea.match(/\bline:(-?[\d.]+)(%?)/);
    const lado = linea.match(/\balign:(\w+)/);

    // Sin porcentaje, `line` cuenta filas de texto: 0 es la de arriba y los
    // negativos se cuentan desde abajo. Con porcentaje es la altura de la
    // pantalla. Las dos formas aparecen en archivos de verdad.
    let fila = 1;
    if (altura) {
        const cuanto = Number(altura[1]);
        if (altura[2] === '%') fila = cuanto <= 25 ? 3 : cuanto >= 75 ? 1 : 2;
        else fila = cuanto >= 0 && cuanto <= 2 ? 3 : 1;
    }

    const columna = lado?.[1] === 'start' || lado?.[1] === 'left' ? 1 : lado?.[1] === 'end' || lado?.[1] === 'right' ? 3 : 2;

    // Abajo en el centro es la de siempre: se enseña como "sin posición" para
    // que el selector no diga que hay algo puesto cuando no lo hay.
    if (fila === 1 && columna === 2 && !altura && !lado) return '';

    // Las casillas van 7-8-9 arriba, 4-5-6 en medio y 1-2-3 abajo.
    return String((fila - 1) * 3 + columna);
}

/**
 * El subtítulo listo para verse encima del vídeo, colocado donde le toca.
 *
 * @param {string} texto
 * @param {Object} entrada
 * @param {Object} documento
 * @returns {{html: string, css: Object, vertical: string, horizontal: string}}
 */
export function paraElVideoElVtt(texto, entrada = {}, documento = {}) {
    const cual = posicionDe(entrada.timecodes);
    const fila = cual ? Math.ceil(Number(cual) / 3) : 1;
    const columna = cual ? ((Number(cual) - 1) % 3) + 1 : 2;

    return {
        // Se limpia primero, como en el resto de la vista previa: lo que se
        // ve encima del vídeo tiene que ser lo que va a quedar en el archivo,
        // no lo que el editor guarde por dentro.
        html: paraVerElVtt(paraLaVistaPrevia(texto, ETIQUETAS_DE_VTT), documento),
        css: {},
        vertical: ['abajo', 'medio', 'arriba'][fila - 1],
        horizontal: ['izquierda', 'centro', 'derecha'][columna - 1],
    };
}

/**
 * El color como lo escribe este formato.
 *
 * El navegador deja el color puesto como `<font color="…">`, que es lo que
 * entiende un SRT. WebVTT no tiene `<font>`: un archivo con esa etiqueta dentro
 * se abre sin protestar y sale en pantalla del color de siempre, porque el
 * reproductor no sabe qué es y se la salta. Aquí se cambia por lo que este
 * formato sí entiende, que es una clase.
 *
 * @param {string} texto Ya limpio, con `<font color>` donde haya color.
 * @returns {string}
 */
export function comoLoEscribeElVtt(texto) {
    // Se recorre en vez de sustituir a lo suelto porque cada apertura decide
    // cómo tiene que ser su cierre, y eso no se puede saber mirando el cierre.
    // Un `<font>` sin color desaparece y su `</font>` también; uno con un color
    // que no se entiende se queda entero, con su cierre. Sustituyendo por
    // separado salían cierres huérfanos, que es un archivo roto.
    const pendientes = [];

    return String(texto ?? '').replace(
        /<font(?:\s[^<>]*)?>|<\/font\s*>/gi,
        (entero) => {
            if (/^<\//.test(entero)) {
                // Un cierre sin apertura no es nuestro: se deja.
                return pendientes.length ? pendientes.pop() : entero;
            }

            const color = entero.match(/\bcolor\s*=\s*["']([^"']*)["']/i);
            const hex = color ? aHex(color[1]) : '';

            if (hex) {
                pendientes.push('</c>');
                return `<c.${COLORES_CON_NOMBRE[hex] || claseDeColor(hex)}>`;
            }

            // Un color que no se entiende se queda como estaba: lo habrá puesto
            // alguien a propósito y no es cosa nuestra borrarlo. Sin color, la
            // etiqueta no dice nada en ningún formato y se va entera.
            pendientes.push(color ? '</font>' : '');
            return color ? entero : '';
        },
    );
}

/**
 * El texto de un subtítulo con la pinta que va a tener en pantalla.
 *
 * En WebVTT el color va en una clase, y el navegador no sabe que `<c.yellow>`
 * es amarillo: sin esto, quien traduce ve el texto en blanco y no se entera de
 * que está pintando un cartel.
 *
 * @param {string} texto
 * @param {{piezas?: Array<Object>}} [documento] Para los colores que el archivo
 *   declara por su cuenta en un bloque STYLE.
 * @returns {string} HTML.
 */
export function paraVerElVtt(texto, documento) {
    const declarados = coloresDeclarados(documento);

    // Primero se pasa por la forma del formato. Lo que viene del archivo ya la
    // trae; lo que viene del editor trae `<font color>`, y así lo que se ve
    // encima del vídeo es exactamente lo que va a quedar escrito, que es de lo
    // que sirve una vista previa.
    //
    // Y se recorre, no se sustituye a lo suelto: solo se cambia el cierre de
    // las etiquetas cuya apertura se ha cambiado. Un `<c.loquesea>` que no
    // dice ningún color se queda tal cual, con su `</c>`.
    const pendientes = [];

    return comoLoEscribeElVtt(texto).replace(
        /<c((?:\.[^\s<>.]+)*)(?:\s[^<>]*)?>|<\/c\s*>/gi,
        (entero, clases) => {
            if (/^<\//.test(entero)) {
                return pendientes.length ? pendientes.pop() : entero;
            }

            // Una etiqueta puede llevar varias clases: <c.grito.yellow>. Manda
            // la última que sea un color, como en el CSS.
            let color = '';
            for (const clase of (clases || '').split('.').filter(Boolean)) {
                const nombrada = NOMBRE_A_COLOR[clase.toLowerCase()];
                const propia = /^color-[0-9a-f]{6}$/i.test(clase) ? `#${clase.slice(6).toLowerCase()}` : '';
                color = nombrada || propia || declarados[clase] || color;
            }

            pendientes.push(color ? '</span>' : '</c>');
            return color ? `<span style="color:${color}">` : entero;
        },
    );
}

/**
 * Los colores que el propio archivo declara en sus bloques STYLE.
 *
 * Se leen solo las reglas sencillas —`::cue(.nombre) { color: … }`—, que son
 * las que se usan para dar color a un trozo de texto. Lo demás que haya en el
 * CSS se respeta en el archivo pero no se intenta pintar aquí.
 *
 * @param {{piezas?: Array<Object>}} [documento]
 * @returns {Object<string, string>} De nombre de clase a color.
 */
function coloresDeclarados(documento) {
    const encontrados = {};
    for (const pieza of documento?.piezas || []) {
        if (pieza.tipo !== 'opaco' || !/^STYLE\b/.test(pieza.texto || '')) continue;
        const reglas = pieza.texto.matchAll(
            /::cue\(\s*\.([^\s)]+)\s*\)\s*\{([^}]*)\}/gi,
        );
        for (const regla of reglas) {
            const color = regla[2].match(/(?:^|[;{\s])color\s*:\s*([^;}]+)/i);
            if (color) encontrados[regla[1]] = color[1].trim();
        }
    }
    return encontrados;
}

/**
 * El bloque STYLE que declara los colores que no son de los ocho de serie.
 *
 * Se escribe solo si hace falta: un archivo que se abre y se guarda sin tocar
 * nada tiene que volver igual, byte a byte, y añadirle una cabecera que no
 * pidió nadie sería cambiarlo.
 *
 * @param {Array<string>} textos Los subtítulos ya escritos.
 * @returns {string} El bloque, o cadena vacía si no hay nada que declarar.
 */
function bloqueDeEstilos(textos) {
    const hacenFalta = new Set();
    for (const texto of textos) {
        for (const uso of String(texto).matchAll(/\.(color-[0-9a-f]{6})\b/gi)) {
            hacenFalta.add(uso[1].toLowerCase());
        }
    }
    if (!hacenFalta.size) return '';

    // Sin líneas en blanco por dentro: en WebVTT una línea en blanco termina el
    // bloque, y las reglas que vinieran después se leerían como un subtítulo.
    const reglas = [...hacenFalta]
        .sort()
        .map((clase) => `::cue(.${clase}) { color: #${clase.slice(6)}; }`);
    return ['STYLE', MARCA, ...reglas].join('\n');
}

/**
 * ¿Es esto un WebVTT?
 *
 * Se mira la primera línea, que es lo que manda el formato: un archivo que no
 * empiece por WEBVTT no lo es, por mucho que la extensión lo diga.
 *
 * @param {string} contenido
 * @returns {boolean}
 */
export function esVtt(contenido) {
    return /^﻿?WEBVTT([ \t\r\n]|$)/.test(String(contenido ?? ''));
}

/**
 * Lee un WebVTT.
 *
 * @param {string} contenido
 * @returns {{entradas: Array<Object>, documento: {piezas: Array<Object>}}}
 *   `documento` es lo que hace falta para devolver el archivo entero: las piezas
 *   que no se traducen, en su orden, con el hueco donde va cada subtítulo.
 */
export function parseVttContent(contenido) {
    const texto = String(contenido ?? '').replace(/^﻿/, '');
    const entradas = [];
    const piezas = [];

    for (const bloque of texto.split(/(?:\r?\n){2,}/)) {
        const lineas = bloque.replace(/\s+$/, '').split(/\r?\n/);
        const donde = lineas.findIndex((linea) => FLECHA.test(linea));

        // Sin línea de tiempos no es un subtítulo: es la cabecera, un
        // comentario, un estilo o una región. Se guarda entera y no se mira.
        //
        // Un NOTE puede llevar dentro una flecha, y entonces parecería un
        // subtítulo: por eso se comprueba antes de qué tipo es el bloque.
        if (donde === -1 || /^(NOTE|STYLE|REGION)\b/.test(lineas[0])) {
            if (bloque.trim()) piezas.push({ tipo: 'opaco', texto: bloque.replace(/\s+$/, '') });
            continue;
        }

        const timecodes = lineas[donde].trim();
        const [inicio, fin] = timecodes.split(FLECHA);
        const startTimeMs = parseTime(inicio);
        const endTimeMs = parseTime(fin);
        const durationMs = endTimeMs - startTimeMs;
        const original = lineas.slice(donde + 1).join('\n');

        piezas.push({ tipo: 'subtitulo', indice: entradas.length });
        entradas.push({
            index: entradas.length + 1,
            // El nombre del subtítulo, si lo trae: en WebVTT sirve para
            // apuntarle un estilo desde el CSS, así que tiene que volver.
            nombre: donde > 0 ? lineas[donde - 1].trim() : '',
            // La línea de tiempos entera, con sus ajustes de posición.
            timecodes,
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

    return { entradas, documento: { piezas } };
}

/**
 * Vuelve a escribir el archivo.
 *
 * Se recorren las piezas en su orden: las opacas se copian tal cual y en las de
 * subtítulo se pone la traducción, o el original si no hay traducción.
 *
 * @param {Array<Object>} entradas
 * @param {{piezas: Array<Object>}} documento
 * @param {{saltoDeLinea?: string, terminaConSalto?: boolean}} [formato]
 * @returns {string}
 */
export function reconstructVtt(entradas, documento, { saltoDeLinea = '\n', terminaConSalto = true } = {}) {
    const piezas = documento?.piezas?.length
        ? documento.piezas
        : // Sin documento —un proyecto guardado antes de que esto existiera—
          // se escribe una cabecera y los subtítulos, que es un VTT válido.
          [{ tipo: 'opaco', texto: 'WEBVTT' }, ...entradas.map((_, indice) => ({ tipo: 'subtitulo', indice }))];

    const bloques = [];
    const textos = [];
    // Dónde va el bloque de estilos, si hace falta: justo antes del primer
    // subtítulo. El formato manda que los STYLE vayan después de la cabecera y
    // antes del primer subtítulo, y ahí caben pase lo que pase.
    let dondeVanLosEstilos = -1;

    for (const pieza of piezas) {
        if (pieza.tipo === 'opaco') {
            // El bloque de estilos que escribimos nosotros se rehace en cada
            // guardado: si no, al cambiar un color quedarían los dos, el de
            // antes y el de ahora.
            if (/^STYLE\b/.test(pieza.texto || '') && pieza.texto.includes(MARCA)) continue;
            bloques.push(pieza.texto);
            continue;
        }

        if (dondeVanLosEstilos === -1) dondeVanLosEstilos = bloques.length;

        const entrada = entradas[pieza.indice];
        if (!entrada) {
            bloques.push('');
            continue;
        }

        const texto = String(entrada.translation || '').trim()
            ? comoLoEscribeElVtt(limpiarParaSubtitulo(entrada.translation, ETIQUETAS_DE_VTT))
            : entrada.original;

        textos.push(texto);
        bloques.push([entrada.nombre, entrada.timecodes, texto].filter((l) => l !== '').join('\n'));
    }

    const estilos = bloqueDeEstilos(textos);
    if (estilos) bloques.splice(dondeVanLosEstilos === -1 ? bloques.length : dondeVanLosEstilos, 0, estilos);

    const contenido = bloques.filter((b) => b !== '').join('\n\n').replace(/\n/g, saltoDeLinea);
    return contenido && terminaConSalto ? contenido + saltoDeLinea : contenido;
}
