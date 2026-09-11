/**
 * Los formatos de subtítulos que entiende subpandaTM, en una sola tabla.
 *
 * La misma idea que en Poanda: un formato es una entrada de esta tabla y nada
 * más. Sin ella, añadir uno obliga a acordarse de tres sitios —la lista de
 * extensiones, el `if` de abrir y el `if` de guardar— y olvidarse de uno da un
 * archivo que se abre pero no se puede guardar.
 *
 * Lo que necesita un formato:
 *
 * - `id`: cómo se llama por dentro. Es lo que se guarda con el proyecto.
 * - `extensiones`: por cuáles se le reconoce.
 * - `etiqueta`: cómo se llama de cara a fuera.
 * - `mime`: con qué tipo se descarga.
 * - `etiquetas`: las que admite dentro de un subtítulo. Lo demás es del editor.
 * - `puede`: qué se le puede ofrecer a quien traduce con este formato abierto.
 *   Ver `SE_PUEDE` más abajo.
 * - `leer(texto)`: devuelve `{entradas, documento}`.
 * - `escribir(entradas, documento, formato)`: vuelve a montar el archivo.
 * - `paraVer(texto)` (opcional): el texto con la pinta que va a tener en
 *   pantalla, para enseñarlo en el editor. No cambia lo que se guarda.
 * - `paraElVideo(texto, entrada, documento)` (opcional): lo mismo para la vista
 *   previa sobre el vídeo, donde además hay que colocar el subtítulo y pintarlo
 *   del color que le toque. Devuelve `{html, css, vertical, horizontal}`.
 * - `ponerLaPosicion(entrada, numero)` (opcional): coloca el subtítulo en una
 *   de las nueve casillas. Solo lo traen los formatos donde la posición no se
 *   escribe dentro del texto: en WebVTT va en la línea de tiempos. Sin esto se
 *   usa la manera del ASS, que es una marca en el propio texto.
 * - `posicionDe(entrada)` (opcional): en qué casilla está puesto ahora, para
 *   que el selector lo enseñe en vez de aparecer siempre en blanco.
 *
 * SOBRE `documento`
 *
 * Es lo que hace falta para devolver el archivo **entero**, no solo los
 * subtítulos: la cabecera, los comentarios, los estilos, las regiones y
 * cualquier cosa que el programa no supiera interpretar. Se guarda con el
 * proyecto y vuelve al archivo tal cual.
 *
 * Ahí está la regla que gobierna todo esto, y es la misma que en Poanda: **se
 * reconstruye sobre el archivo que se abrió, no se escribe uno nuevo**. La
 * diferencia entre "guardar" y "rehacer el archivo con lo que he entendido de
 * él". El SRT no tiene nada que guardar aparte de los subtítulos, así que su
 * `documento` va vacío; el WebVTT sí, y por eso el primero que entra por esta
 * puerta es él.
 */
import { ETIQUETAS_DE_SRT, parseSrtContent, reconstructSrt } from '@core/srt.js';
import {
    ETIQUETAS_DE_VTT,
    conLaPosicion,
    esVtt,
    posicionDe,
    paraElVideoElVtt,
    paraVerElVtt,
    parseVttContent,
    reconstructVtt,
} from '@core/vtt.js';
import { ETIQUETAS_DE_TTML, esTtml, paraVerElTtml, parseTtmlContent, reconstructTtml } from '@core/ttml.js';
import {
    ETIQUETAS_DE_ASS,
    esAss,
    posicionDeLasMarcas,
    paraElVideoElAss,
    paraVerElAss,
    parseAssContent,
    reconstructAss,
} from '@core/ass.js';

/**
 * Qué se le puede ofrecer con cada formato abierto.
 *
 * No todos los formatos saben hacer lo mismo, y la diferencia no es cosa de
 * quien traduce. Poner el botón de la posición con un SRT abierto es ofrecer
 * algo que no existe en ese formato: se pulsa, parece que pasa algo y el
 * archivo sale igual. Así que la lista de lo que se puede la lleva el formato,
 * y la fila de botones se pinta con lo que diga.
 *
 * Tres respuestas, porque "sí o no" sería mentira en un caso:
 *
 * - `si`      El formato lo admite y subpandaTM lo escribe. Botón normal.
 * - `segun`   Se usa mucho pero no está en ninguna norma, así que hay
 *             reproductores que lo respetan y reproductores que lo tiran. El
 *             botón está, con una marca y un aviso al pasar el ratón.
 * - `no`      No se ofrece. Puede ser porque el formato no sepa hacerlo —la
 *             posición en un SRT— o porque subpandaTM todavía no lo escriba
 *             —la posición en un TTML, que se hace con regiones declaradas en
 *             la cabecera—. Para quien traduce el efecto es el mismo: ese
 *             botón no aparece.
 */
export const SE_PUEDE = { SI: 'si', SEGUN: 'segun', NO: 'no' };

/** @type {Array<Object>} */
export const FORMATOS = [
    {
        id: 'srt',
        extensiones: ['.srt'],
        etiqueta: 'SubRip (.srt)',
        mime: 'text/plain;charset=utf-8',
        etiquetas: ETIQUETAS_DE_SRT,
        // El SRT no tiene norma escrita: lo que se puede es lo que los
        // reproductores han acabado entendiendo. La cursiva, la negrita y el
        // subrayado los entiende todo. El color se escribe con <font>, que
        // viene del HTML de hace treinta años: los reproductores de ordenador
        // lo respetan y muchos de los de televisión y las cadenas lo quitan.
        // Y posición no tiene ninguna.
        puede: { cursiva: 'si', negrita: 'si', subrayado: 'si', color: 'segun', posicion: 'no' },
        leer: (texto) => ({ entradas: parseSrtContent(texto), documento: null }),
        escribir: (entradas, documento, formato) => reconstructSrt(entradas, formato),
    },
    {
        id: 'vtt',
        extensiones: ['.vtt'],
        etiqueta: 'WebVTT (.vtt)',
        mime: 'text/vtt;charset=utf-8',
        etiquetas: ETIQUETAS_DE_VTT,
        // WebVTT sí tiene norma, y las cinco están en ella. La posición va en
        // la línea de tiempos y no en el texto: es otro sitio distinto que en
        // ASS, pero el botón de quien traduce es el mismo.
        puede: { cursiva: 'si', negrita: 'si', subrayado: 'si', color: 'si', posicion: 'si' },
        leer: (texto) => parseVttContent(texto),
        escribir: (entradas, documento, formato) => reconstructVtt(entradas, documento, formato),
        // En WebVTT el color no es una etiqueta sino una clase —<c.yellow>—, y
        // el navegador no sabe que esa clase es un color. Sin esto, quien
        // traduce ve en blanco lo que va a salir en amarillo.
        paraVer: (texto, documento) => paraVerElVtt(texto, documento),
        paraElVideo: (texto, entrada, documento) => paraElVideoElVtt(texto, entrada, documento),
        // Aquí la posición no se escribe en el texto: se cambian los ajustes de
        // la línea de tiempos, así que es el formato quien sabe hacerlo.
        ponerLaPosicion: (entrada, numero) => {
            entrada.timecodes = conLaPosicion(entrada.timecodes, numero);
        },
        posicionDe: (entrada) => posicionDe(entrada?.timecodes),
    },
    {
        id: 'ttml',
        // .dfxp y .xml son el mismo formato con otro nombre: el .dfxp viene de
        // cuando esto era de Adobe y el .xml es lo que mandan varias
        // plataformas grandes sin más señas.
        extensiones: ['.ttml', '.dfxp', '.xml'],
        etiqueta: 'TTML / IMSC (.ttml, .dfxp, .xml)',
        mime: 'application/ttml+xml',
        etiquetas: ETIQUETAS_DE_TTML,
        // En TTML todo esto son atributos de estilo, y están en la norma. La
        // posición se hace con regiones, que es otra historia y está sin hacer.
        puede: { cursiva: 'si', negrita: 'si', subrayado: 'si', color: 'si', posicion: 'no' },
        leer: (texto) => parseTtmlContent(texto),
        escribir: (entradas, documento) => reconstructTtml(entradas, documento),
        // En TTML la cursiva es un atributo del <span>, y el navegador no sabe
        // que lo es: sin esto, quien traduce no ve en cursiva lo que va a salir
        // en cursiva.
        paraVer: (texto) => paraVerElTtml(texto),
    },
    {
        id: 'ass',
        // El .ssa es el mismo formato de antes de que le añadieran estilos.
        extensiones: ['.ass', '.ssa'],
        etiqueta: 'Advanced SubStation (.ass, .ssa)',
        mime: 'text/plain;charset=utf-8',
        etiquetas: ETIQUETAS_DE_ASS,
        // El ASS es el que más sabe hacer: es el formato de los fansubs y de
        // los carteles, y lo lleva todo dentro del propio texto.
        puede: { cursiva: 'si', negrita: 'si', subrayado: 'si', color: 'si', posicion: 'si' },
        leer: (texto) => parseAssContent(texto),
        escribir: (entradas, documento) => reconstructAss(entradas, documento),
        // En ASS la cursiva es una marca dentro del texto, {\i1}, y el navegador
        // no sabe que lo es.
        paraVer: (texto) => paraVerElAss(texto),
        // Y el color, el cuerpo y la esquina en la que sale cada línea no están
        // en el texto: están en su estilo, en la cabecera del archivo.
        paraElVideo: (texto, entrada, documento) => paraElVideoElAss(texto, entrada, documento),
        // Aquí la posición está dentro del texto, así que se lee de la
        // traducción si la hay y del original si todavía no la hay.
        posicionDe: (entrada) =>
            posicionDeLasMarcas(entrada?.translation?.trim() ? entrada.translation : entrada?.original),
    },
];

/** Las extensiones que se pueden abrir, para el selector de archivos. */
export const EXTENSIONES = FORMATOS.flatMap((f) => f.extensiones);

/**
 * @param {string} id
 * @returns {Object} El formato, o el SRT si el id no se conoce.
 */
export function formatoPorId(id) {
    return FORMATOS.find((f) => f.id === id) || FORMATOS[0];
}

/**
 * De qué formato es un archivo.
 *
 * Manda lo que diga el contenido y no la extensión: un .vtt renombrado a .srt
 * sigue siendo un WebVTT, y abrirlo como SRT daría un archivo lleno de
 * subtítulos rotos sin decir por qué. La extensión decide solo cuando el
 * contenido no aclara nada.
 *
 * @param {string} nombre
 * @param {string} contenido
 * @returns {Object}
 */
export function formatoDe(nombre, contenido) {
    if (esVtt(contenido)) return formatoPorId('vtt');
    if (esTtml(contenido)) return formatoPorId('ttml');
    if (esAss(contenido)) return formatoPorId('ass');

    const punto = String(nombre || '').lastIndexOf('.');
    const extension = punto === -1 ? '' : nombre.slice(punto).toLowerCase();
    return FORMATOS.find((f) => f.extensiones.includes(extension)) || formatoPorId('srt');
}

/**
 * Le cambia la extensión a un nombre de archivo.
 *
 * @param {string} nombre
 * @param {Object} formato
 * @returns {string}
 */
export function conLaExtensionDe(nombre, formato) {
    return sinExtension(nombre) + formato.extensiones[0];
}

/**
 * Le quita la extensión de subtítulos a un nombre de archivo.
 *
 * Solo las que conoce esta tabla, y solo al final: un "cap.01.ass" se queda en
 * "cap.01", no en "cap".
 *
 * Está aparte de `conLaExtensionDe` porque hace falta por su cuenta: al
 * proponer el nombre de la exportación se le añade "_trad" en medio, y
 * entonces la extensión ya no está al final y no hay quien la recorte. Cuando
 * esto se hacía con un `.replace(/\.(srt|vtt)$/)` escrito a mano ahí mismo, un
 * "pelicula.ass" salía como "pelicula.ass_trad.ass": la lista de extensiones se
 * quedó donde estaba cuando solo había dos formatos.
 *
 * @param {string} nombre
 * @returns {string}
 */
export function sinExtension(nombre) {
    const conocidas = EXTENSIONES.map((e) => e.slice(1)).join('|');
    return String(nombre || 'subtitulos').replace(new RegExp(`\\.(?:${conocidas})$`, 'i'), '');
}
