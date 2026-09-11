/**
 * ASS y SSA: los subtítulos con estilo.
 *
 * Es el formato de Aegisub, y el que se usa cuando el subtítulo hace algo más
 * que estar abajo en blanco: carteles, letreros, karaoke, un personaje que habla
 * en amarillo desde una esquina. Vive en el fansub, en el anime y en cualquier
 * encargo donde haya que rotular algo que aparece en pantalla.
 *
 * CÓMO ES UN ARCHIVO
 *
 *     [Script Info]          ← la cabecera: título, resolución del vídeo
 *     [V4+ Styles]           ← los estilos: fuente, cuerpo, color, posición
 *       Format: Name, Fontname, …
 *       Style: Default,Arial,48,…
 *     [Events]               ← los subtítulos
 *       Format: Layer, Start, End, Style, Name, …, Text
 *       Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hola {\i1}mundo{\i0}
 *
 * DOS COSAS QUE HAY QUE HACER BIEN O NO SE HACE NADA
 *
 * La primera: **el orden de los campos lo dice la línea `Format:`**, no el
 * manual. Un SSA antiguo empieza por `Marked` donde un ASS empieza por `Layer`,
 * y hay archivos que los reordenan. Darlo por sabido es leer el estilo donde
 * está el tiempo.
 *
 * La segunda: **el texto es el último campo justamente porque puede llevar
 * comas**. Partir la línea por todas las comas se come media traducción en
 * cuanto alguien escribe "Hola, mundo".
 *
 * LAS MARCAS DE DENTRO
 *
 * `{\i1}` es cursiva, `{\an8}` manda el subtítulo arriba, `{\pos(300,400)}` lo
 * clava en un punto, `{\fad(200,200)}` lo funde. Todo eso lo puso alguien y todo
 * eso tiene que volver, así que viaja dentro del segmento como una etiqueta más,
 * a la vista de quien traduce —igual que en Aegisub— en lugar de esconderse.
 *
 * Y como siempre: **se reconstruye sobre el archivo que se abrió, no se escribe
 * uno nuevo**. Se apunta en qué posición exacta empieza y acaba cada campo de
 * texto y al guardar se sustituye solo eso.
 */
import {
    calculateCPS,
    countCharactersWithoutTags,
    countWords,
    formatTime,
    limpiarParaSubtitulo,
} from './srt.js';
import { sustituirTramos } from './tramos.js';

/**
 * Las etiquetas que se dejan pasar desde el campo del editor.
 *
 * Ninguna llega al archivo: son las que el navegador escribe cuando se pone algo
 * en cursiva, y justo antes de guardar se cambian por las marcas del formato
 * (ver `comoLoEscribeElFormato`). En un ASS un `<i>` es texto que se ve en
 * pantalla, con sus corchetes angulares y todo.
 */
export const ETIQUETAS_DE_ASS = ['b', 'i', 'u', 'font'];

/** La misma idea escrita de dos maneras: como el editor y como el formato. */
const ESTILOS = [
    { etiqueta: 'i', marca: 'i' },
    { etiqueta: 'b', marca: 'b' },
    { etiqueta: 'u', marca: 'u' },
];

/**
 * ¿Es esto un ASS o un SSA?
 *
 * Se miran sus dos secciones obligatorias. La extensión no basta y el nombre de
 * la sección de estilos cambia entre versiones —`[V4 Styles]` en el SSA de
 * siempre, `[V4+ Styles]` en el ASS—, así que se busca lo que tienen los dos.
 *
 * @param {string} contenido
 * @returns {boolean}
 */
export function esAss(contenido) {
    const texto = String(contenido ?? '');
    return /^﻿?\s*\[Script Info\]/i.test(texto) && /^\s*\[Events\]/im.test(texto);
}

/**
 * Un tiempo de ASS a milisegundos.
 *
 * Se escriben `H:MM:SS.cc`, con centésimas y no milésimas.
 *
 * @param {string} valor
 * @returns {number} Milisegundos, o NaN si ahí no hay un tiempo.
 */
export function tiempoAssAMs(valor) {
    const partes = String(valor ?? '')
        .trim()
        .match(/^(\d+):(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);
    if (!partes) return NaN;

    const [, h, m, s, fraccion] = partes;
    // Las centésimas son dos cifras; si vienen tres, son milésimas.
    const sueltos = fraccion.length >= 3 ? Number(fraccion.slice(0, 3)) : Number(fraccion) * 10;
    return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + sueltos;
}

/**
 * Milisegundos a tiempo de ASS.
 *
 * @param {number} ms
 * @returns {string}
 */
export function msATiempoAss(ms) {
    // Se redondea a la centésima y no se trunca: 1,999 s son dos segundos, no
    // uno con noventa y nueve, y un fotograma de diferencia se ve.
    const centesimas = Math.max(0, Math.round(Number(ms) / 10));
    const total = Math.floor(centesimas / 100);

    const dos = (n) => String(n).padStart(2, '0');
    return [
        Math.floor(total / 3600),
        dos(Math.floor((total % 3600) / 60)),
        dos(total % 60),
    ].join(':') + `.${dos(centesimas % 100)}`;
}

/**
 * Lee un ASS o un SSA.
 *
 * @param {string} contenido
 * @returns {{entradas: Array<Object>, documento: Object}}
 */
export function parseAssContent(contenido) {
    const texto = String(contenido ?? '');
    const entradas = [];
    const lineas = [];

    // Qué campo es cada uno. Se va actualizando: el archivo trae una línea
    // "Format:" por sección, y hacen falta las dos: la de [Events] para los
    // diálogos y la de los estilos para saber de qué color sale cada uno.
    let campos = null;
    let camposDeEstilo = null;
    let seccion = '';
    let donde = 0;

    const estilos = {};
    // El SSA de siempre cuenta la alineación de otra manera que el ASS, y la
    // sección se llama distinto, que es justo por donde se distinguen.
    let esV4Plus = false;

    for (const linea of texto.split('\n')) {
        const largo = linea.length + 1;
        const principio = donde;
        donde += largo;

        const cabecera = linea.match(/^\s*\[([^\]]+)\]/);
        if (cabecera) {
            seccion = cabecera[1].trim().toLowerCase();
            if (/styles/.test(seccion)) esV4Plus = seccion.includes('+');
            continue;
        }

        const formato = linea.match(/^\s*Format\s*:(.*)$/i);
        if (formato) {
            const nombres = formato[1].split(',').map((c) => c.trim().toLowerCase());
            if (seccion === 'events') campos = nombres;
            else if (/styles/.test(seccion)) camposDeEstilo = nombres;
            continue;
        }

        // Los estilos: de qué color, con qué letra y en qué esquina sale cada
        // línea. En un archivo con varios estilos, esto es lo que hace que un
        // cartel se vea como un cartel y no como un diálogo.
        const estilo = linea.match(/^\s*Style\s*:(.*)$/i);
        if (estilo && camposDeEstilo) {
            const valores = estilo[1].split(',');
            const cual = (nombre) => {
                const donde = camposDeEstilo.indexOf(nombre);
                return donde === -1 ? '' : (valores[donde] ?? '').trim();
            };
            const nombre = cual('name');
            if (nombre) estilos[nombre] = leerElEstilo(cual, esV4Plus);
            continue;
        }

        if (seccion !== 'events') continue;

        // Solo los "Dialogue". Un "Comment" es un diálogo apagado: no sale en el
        // vídeo, así que no hay nada que traducir en él, pero tiene que volver.
        const dialogo = linea.match(/^\s*Dialogue\s*:(.*)$/i);
        if (!dialogo || !campos) continue;

        const trozos = partirPorCampos(dialogo[1], campos.length);
        const valor = (nombre) => {
            const cual = campos.indexOf(nombre);
            return cual === -1 ? '' : (trozos[cual] ?? '').trim();
        };

        const cualTexto = campos.indexOf('text');
        if (cualTexto === -1) continue;

        // Dónde empieza el texto dentro del archivo. Se calcula sobre la línea
        // entera para poder sustituir solo ese trozo al guardar.
        const antesDelTexto = trozos.slice(0, cualTexto).join(',').length;
        const desdeElDosPuntos = linea.length - dialogo[1].length;
        const textoInicio = principio + desdeElDosPuntos + antesDelTexto + (cualTexto > 0 ? 1 : 0);

        const crudo = trozos[cualTexto] ?? '';
        const startTimeMs = tiempoAssAMs(valor('start')) || 0;
        const endTimeMs = tiempoAssAMs(valor('end')) || 0;
        const durationMs = Math.max(0, endTimeMs - startTimeMs);

        // El \N es un salto de línea duro; se pasa a salto de verdad para que el
        // editor cuente las líneas y los caracteres por línea como siempre. El
        // \n blando y el \h (espacio duro) se dejan como están: son del
        // maquetador y no son saltos que se vean escritos.
        const original = crudo.replace(/\\N/g, '\n');

        lineas.push({
            inicio: principio,
            fin: principio + linea.length,
            textoInicio,
            textoFin: textoInicio + crudo.length,
            textoOriginal: original,
            startTimeMs,
            endTimeMs,
            // El principio de la línea hasta el texto, para poder rehacerla
            // entera cuando un subtítulo se parte en dos.
            cabecera: linea.slice(0, textoInicio - principio),
            campos,
            trozos,
        });

        entradas.push({
            index: entradas.length + 1,
            // De qué línea del archivo salió. Es lo que permite partir y
            // fusionar sin perder de vista a qué trozo corresponde cada uno.
            linea: lineas.length - 1,
            estilo: valor('style'),
            nombre: valor('name'),
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

    return {
        entradas,
        documento: {
            texto,
            lineas,
            estilos,
            // Cómo de grande es el vídeo para el que se maquetó: los cuerpos de
            // letra están en píxeles de ese vídeo, no del que se esté viendo.
            resolucion: {
                x: Number(texto.match(/^\s*PlayResX\s*:\s*(\d+)/im)?.[1]) || 0,
                y: Number(texto.match(/^\s*PlayResY\s*:\s*(\d+)/im)?.[1]) || 0,
            },
        },
    };
}

/**
 * Parte los campos de un "Dialogue:", dejando el texto de una pieza.
 *
 * El texto es el último campo y puede llevar comas, así que se corta por las
 * primeras `cuantos - 1` y lo que quede es el texto, entero.
 *
 * @param {string} cadena
 * @param {number} cuantos
 * @returns {string[]}
 */
function partirPorCampos(cadena, cuantos) {
    const trozos = [];
    let resto = String(cadena ?? '');

    for (let i = 0; i < cuantos - 1; i += 1) {
        const coma = resto.indexOf(',');
        if (coma === -1) break;
        trozos.push(resto.slice(0, coma));
        resto = resto.slice(coma + 1);
    }

    trozos.push(resto);
    return trozos;
}

/**
 * Vuelve a escribir el archivo.
 *
 * @param {Array<Object>} entradas
 * @param {Object} documento
 * @returns {string}
 */
export function reconstructAss(entradas, documento) {
    const texto = documento?.texto;
    if (!texto) return '';

    const lineas = documento.lineas || [];

    const porLinea = lineas.map(() => []);
    for (const entrada of entradas) {
        const cual = entrada.linea;
        if (Number.isInteger(cual) && porLinea[cual]) porLinea[cual].push(entrada);
    }

    const tramos = [];

    lineas.forEach((linea, i) => {
        const suyas = porLinea[i];

        // Sin subtítulos: se ha borrado o se ha fusionado con el anterior. Se
        // lleva por delante el salto de línea, para no dejar un hueco en blanco
        // en medio del archivo.
        if (suyas.length === 0) {
            tramos.push({ inicio: linea.inicio, fin: linea.fin + 1, texto: '' });
            return;
        }

        if (suyas.length === 1) {
            const entrada = suyas[0];

            const contenido = escribirTexto(entrada);
            if (contenido !== escribirTexto({ original: linea.textoOriginal })) {
                tramos.push({ inicio: linea.textoInicio, fin: linea.textoFin, texto: contenido });
            }

            // Los tiempos solo si se han movido, y comparando milisegundos y no
            // cómo están escritos.
            if (entrada.startTimeMs !== linea.startTimeMs || entrada.endTimeMs !== linea.endTimeMs) {
                tramos.push({
                    inicio: linea.inicio,
                    fin: linea.textoInicio,
                    texto: cabeceraDe(linea, entrada),
                });
            }
            return;
        }

        // Varias: la línea se partió. Se escriben tantas líneas como haga falta,
        // todas con el mismo estilo y cada una con sus tiempos.
        const nuevas = suyas
            .map((entrada) => `${cabeceraDe(linea, entrada)}${escribirTexto(entrada)}`)
            .join('\n');
        tramos.push({ inicio: linea.inicio, fin: linea.fin, texto: nuevas });
    });

    return sustituirTramos(texto, tramos);
}

/**
 * El principio de una línea de diálogo, con los tiempos al día.
 *
 * Se rehace desde los campos que se leyeron, para no depender de dónde caía cada
 * coma: así vale igual con un ASS que con un SSA que ponga los campos en otro
 * orden.
 */
function cabeceraDe(linea, entrada) {
    const trozos = [...linea.trozos];
    const poner = (nombre, valor) => {
        const cual = linea.campos.indexOf(nombre);
        if (cual !== -1) trozos[cual] = valor;
    };

    poner('start', msATiempoAss(entrada.startTimeMs));
    poner('end', msATiempoAss(entrada.endTimeMs));

    const cualTexto = linea.campos.indexOf('text');
    const antes = trozos.slice(0, cualTexto).join(',');
    // El "Dialogue: " y lo que hubiera de sangría, tal como venía.
    const comoEmpieza = linea.cabecera.match(/^\s*Dialogue\s*:/i)?.[0] || 'Dialogue: ';

    return `${comoEmpieza}${antes}${cualTexto > 0 ? ',' : ''}`;
}

/**
 * El texto de un subtítulo, listo para escribirlo en el archivo.
 *
 * @param {{translation?: string, original?: string}} entrada
 * @returns {string}
 */
function escribirTexto(entrada) {
    const traduccion = String(entrada.translation || '').trim();
    const texto = traduccion
        ? comoLoEscribeElFormato(limpiarParaSubtitulo(traduccion, ETIQUETAS_DE_ASS))
        : String(entrada.original ?? '');

    // Un salto de línea de verdad partiría el archivo en dos: una línea de
    // diálogo es una línea del archivo.
    return texto.replace(/\r?\n/g, '\\N');
}

/**
 * Pasa a marcas del formato las etiquetas que escribe el editor.
 *
 * @param {string} texto
 * @returns {string}
 */
function comoLoEscribeElFormato(texto) {
    let salida = String(texto ?? '');

    for (const { etiqueta, marca } of ESTILOS) {
        salida = salida
            .replace(new RegExp(`<${etiqueta}(?:\\s[^<>]*)?>`, 'gi'), `{\\${marca}1}`)
            .replace(new RegExp(`</${etiqueta}\\s*>`, 'gi'), `{\\${marca}0}`);
    }

    // El color. El navegador lo escribe como <font color="…"> y aquí se escribe
    // como una marca dentro del texto; sin esto, pintar una palabra de amarillo
    // se veía en el editor y salía en blanco en el archivo, sin avisar.
    salida = salida
        .replace(/<font[^<>]*\bcolor\s*=\s*["']([^"']*)["'][^<>]*>/gi, (entero, color) => {
            const enAss = cssAColorAss(color);
            return enAss ? `{\\c${enAss}}` : '';
        })
        .replace(/<font(?:\s[^<>]*)?>/gi, '')
        // Un {\c} a secas es "vuelve al color del estilo", que es justo lo que
        // significa cerrar el <font>.
        .replace(/<\/font\s*>/gi, '{\\c}');

    return salida;
}

/**
 * Un color de siempre al color de ASS.
 *
 * Es el camino de vuelta de `colorAssACss`: van al revés —azul, verde y rojo— y
 * con la transparencia delante.
 *
 * @param {string} valor `#rrggbb`, `#rgb` o `rgb(r, g, b)`.
 * @returns {string} `&HBBGGRR&`, o cadena vacía si no se entiende.
 */
export function cssAColorAss(valor) {
    const cadena = String(valor ?? '').trim();

    let rojo;
    let verde;
    let azul;

    const enHex = cadena.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (enHex) {
        const seis =
            enHex[1].length === 3
                ? enHex[1].split('').map((c) => c + c).join('')
                : enHex[1];
        [rojo, verde, azul] = [0, 2, 4].map((i) => parseInt(seis.slice(i, i + 2), 16));
    } else {
        const enRgb = cadena.match(/^rgba?\(([^)]+)\)$/i);
        if (!enRgb) return '';
        [rojo, verde, azul] = enRgb[1].split(',').map((n) => Number(n.trim()));
    }

    if (![rojo, verde, azul].every((n) => Number.isFinite(n))) return '';

    const dos = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
    return `&H${dos(azul)}${dos(verde)}${dos(rojo)}&`;
}

/**
 * El texto con la pinta que va a tener en pantalla.
 *
 * Las marcas de estilo se convierten para que la cursiva se vea en cursiva. Las
 * demás —`{\an8}`, `{\pos(...)}`, `{\fad(...)}`— se dejan a la vista, como en
 * Aegisub: dicen dónde y cómo sale el subtítulo, las puso alguien, y esconderlas
 * es la manera de que se pierdan al traducir.
 *
 * @param {string} texto
 * @returns {string} HTML para pintar en el editor.
 */
export function paraVerElAss(texto) {
    let salida = String(texto ?? '');

    for (const { etiqueta, marca } of ESTILOS) {
        salida = salida
            .replace(new RegExp(`\\{\\\\${marca}1\\}`, 'g'), `<${etiqueta}>`)
            .replace(new RegExp(`\\{\\\\${marca}0\\}`, 'g'), `</${etiqueta}>`);
    }

    // El color también, para que se vea del color que va a salir.
    salida = salida
        .replace(/\{\\1?c&H([0-9a-f]{1,8})&\}/gi, (entero, hex) => {
            const enCss = colorAssACss(`&H${hex}&`);
            return enCss ? `<font color="${enCss}">` : entero;
        })
        .replace(/\{\\1?c\}/g, '</font>');

    return salida;
}

// --------------------------------------------------------------------------
// Ver el subtítulo como se va a ver en el vídeo
// --------------------------------------------------------------------------

/**
 * Lee un estilo de la sección `[V4+ Styles]`.
 *
 * @param {function} cual Da el valor de un campo por su nombre.
 * @param {boolean} esV4Plus
 * @returns {Object}
 */
function leerElEstilo(cual, esV4Plus) {
    return {
        fuente: cual('fontname'),
        cuerpo: Number(cual('fontsize')) || 0,
        color: colorAssACss(cual('primarycolour')),
        // En ASS un 1 es sí y un 0 es no, pero también aparece -1 por sí: viene
        // de cuando esto se escribía en Basic.
        negrita: /^-?1$/.test(cual('bold')),
        cursiva: /^-?1$/.test(cual('italic')),
        subrayado: /^-?1$/.test(cual('underline')),
        ...donde(Number(cual('alignment')) || 2, esV4Plus),
    };
}

/**
 * Dónde va el subtítulo en pantalla.
 *
 * El ASS cuenta las nueve posiciones como el teclado numérico: el 1 es abajo a
 * la izquierda y el 9 arriba a la derecha. El SSA de siempre lo contaba de otra
 * manera —1, 2 y 3 abajo, +4 arriba, +8 en medio— y hay archivos de los dos.
 *
 * @param {number} numero
 * @param {boolean} esV4Plus
 * @returns {{vertical: string, horizontal: string}}
 */
function donde(numero, esV4Plus) {
    if (esV4Plus) {
        const fila = Math.ceil(numero / 3);
        return {
            vertical: ['abajo', 'medio', 'arriba'][fila - 1] || 'abajo',
            horizontal: ['izquierda', 'centro', 'derecha'][(numero - 1) % 3] || 'centro',
        };
    }

    const arriba = (numero & 4) !== 0;
    const enMedio = (numero & 8) !== 0;
    return {
        vertical: enMedio ? 'medio' : arriba ? 'arriba' : 'abajo',
        horizontal: ['izquierda', 'centro', 'derecha'][(numero & 3) - 1] || 'centro',
    };
}

/**
 * Un color de ASS al color de siempre.
 *
 * Se escriben `&HAABBGGRR`: primero la transparencia y después azul, verde y
 * rojo, al revés de como se escriben en cualquier otro sitio. Los SSA antiguos
 * lo ponen en decimal.
 *
 * @param {string} valor
 * @returns {string} Un color CSS, o cadena vacía si no se entiende.
 */
export function colorAssACss(valor) {
    const cadena = String(valor ?? '').trim();
    if (!cadena) return '';

    const enHex = cadena.match(/^&H([0-9a-f]{1,8})&?$/i);
    const numero = enHex ? parseInt(enHex[1], 16) : Number(cadena);
    if (!Number.isFinite(numero)) return '';

    const azul = (numero >> 16) & 0xff;
    const verde = (numero >> 8) & 0xff;
    const rojo = numero & 0xff;
    // La transparencia va al revés que en CSS: 0 es opaco y 255 invisible.
    const opacidad = 1 - (((numero >> 24) & 0xff) / 255);

    return opacidad >= 0.999
        ? `rgb(${rojo}, ${verde}, ${azul})`
        : `rgba(${rojo}, ${verde}, ${azul}, ${opacidad.toFixed(2)})`;
}

/**
 * Las marcas que se pueden enseñar y las que no.
 *
 * `{\i1}` es cursiva y se puede pintar. `{\pos(300,400)}`, `{\fad(200,200)}`,
 * `{\t(...)}`, `{\clip(...)}` y las de dibujo son movimiento, recortes y formas:
 * en una vista previa quieta no se pueden representar, así que se quitan. Lo que
 * no se puede quitar es dejarlas escritas encima de la cara de alguien, que es
 * lo que pasaba.
 */
const MARCAS = /\{([^}]*)\}/g;

/**
 * El subtítulo como se va a ver en el vídeo.
 *
 * Esto es lo que separa una vista previa de un cuadro de texto: en un ASS, el
 * color, el cuerpo, la cursiva y la esquina en la que sale cada línea no están
 * en el texto, están en su estilo. Un archivo con cuatro estilos son cuatro
 * cosas distintas en pantalla, y enseñarlas todas iguales es no enseñar nada.
 *
 * @param {string} texto El texto del subtítulo, con sus marcas.
 * @param {Object} [entrada] El subtítulo, para saber qué estilo usa.
 * @param {Object} [documento] Lo que se leyó del archivo.
 * @returns {{html: string, css: Object, vertical: string, horizontal: string}}
 */
export function paraElVideoElAss(texto, entrada = {}, documento = {}) {
    const estilos = documento.estilos || {};
    const estilo = estilos[entrada.estilo] || estilos.Default || {};

    let salida = String(texto ?? '');
    let alineacion = null;
    let colorDeLaMarca = '';

    // Las marcas de dentro mandan sobre el estilo de la línea, que es como
    // funciona el formato.
    salida = salida.replace(MARCAS, (entero, dentro) => {
        const posicion = dentro.match(/\\an?(\d)/);
        if (posicion) alineacion = Number(posicion[1]);

        const color = dentro.match(/\\(?:1?c)&H([0-9a-f]{1,8})&/i);
        if (color) colorDeLaMarca = colorAssACss(`&H${color[1]}&`);

        // Cursiva, negrita y subrayado sí se pueden pintar; el resto no, y
        // dejarlas escritas es peor que quitarlas.
        return ESTILOS.map(({ etiqueta, marca }) => {
            const cambia = dentro.match(new RegExp(`\\\\${marca}([01])`));
            return cambia ? (cambia[1] === '1' ? `<${etiqueta}>` : `</${etiqueta}>`) : '';
        }).join('');
    });

    const css = {};
    if (colorDeLaMarca || estilo.color) css.color = colorDeLaMarca || estilo.color;
    if (estilo.fuente) css.fontFamily = `${estilo.fuente}, sans-serif`;
    if (estilo.negrita) css.fontWeight = '700';
    if (estilo.cursiva) css.fontStyle = 'italic';
    if (estilo.subrayado) css.textDecoration = 'underline';

    // El cuerpo, en proporción al estilo más usado y no en píxeles: los del
    // archivo son de un vídeo de 1920×1080 y la vista previa mide lo que mida.
    // Así un cartel más pequeño que el diálogo se sigue viendo más pequeño, y
    // el tamaño general lo sigue mandando quien traduce con su selector.
    const referencia = estilos.Default?.cuerpo || 0;
    if (estilo.cuerpo && referencia && estilo.cuerpo !== referencia) {
        css.fontSize = `${Math.round((estilo.cuerpo / referencia) * 100)}%`;
    }

    const puesto = alineacion === null ? null : donde(alineacion, true);

    return {
        html: salida,
        css,
        vertical: puesto?.vertical || estilo.vertical || 'abajo',
        horizontal: puesto?.horizontal || estilo.horizontal || 'centro',
    };
}

/**
 * En qué casilla está puesto un subtítulo, mirando sus marcas.
 *
 * En ASS la posición va dentro del texto —`{\\an8}` es arriba en el centro—, así
 * que se lee de ahí. Sirve para que el selector enseñe dónde está puesto en vez
 * de aparecer siempre en blanco.
 *
 * @param {string} texto
 * @returns {string} Del 1 al 9, o cadena vacía si no lleva ninguna.
 */
export function posicionDeLasMarcas(texto) {
    const marca = String(texto ?? '').match(/\{[^{}]*\\an(\d)[^{}]*\}/);
    return marca ? marca[1] : '';
}
