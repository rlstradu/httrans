/**
 * Lo que en un subtítulo no es texto y no se traduce.
 *
 * En un subtítulo hay muy poco de esto, y por eso este módulo es corto: la
 * cursiva (`<i>…</i>`), alguna negrita o subrayado heredados de otra
 * herramienta, la etiqueta de color de algunos reproductores y las órdenes de
 * posición al estilo de ASS (`{\an8}`), que aparecen en archivos convertidos.
 * Nada más.
 *
 * Hace falta reconocerlas para poder esconderlas antes de mandarle el texto a
 * una IA. A un modelo le mandas `<i>Vámonos</i>` y te devuelve `<I>` o se deja
 * el cierre, y eso sale en pantalla como un `<i>` literal encima de la cara de
 * alguien. Cómo se esconden y cómo se devuelven a su sitio está en
 * marcadores.js; aquí solo se dice qué buscar.
 */

/**
 * Lo que se protege, por orden de aparición en el texto.
 *
 * - `<i>`, `</i>`, `<b>`, `<u>`, `<font color="#fff">`, `</font>`…
 * - `{\an8}`, `{\pos(320,240)}` y demás órdenes entre llaves con barra.
 */
const ETIQUETAS = /<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^<>]*)?>|\{\\[^}]*\}/g;

/**
 * Encuentra las etiquetas de un subtítulo.
 *
 * La firma es la misma que la de Poanda para que marcadores.js sea el mismo
 * módulo en las dos herramientas; aquí no hay perfiles de formato que elegir,
 * porque solo se traduce un formato.
 *
 * @param {string} texto
 * @returns {Array<{texto: string, inicio: number, fin: number}>}
 */
export function extraerEtiquetas(texto) {
    const cadena = String(texto ?? '');
    if (!cadena) return [];

    const encontradas = [];
    // Una expresión con la bandera global recuerda por dónde iba entre
    // llamadas, así que se arranca de cero cada vez: si no, el primer subtítulo
    // sale bien y el siguiente no.
    ETIQUETAS.lastIndex = 0;

    let coincidencia;
    while ((coincidencia = ETIQUETAS.exec(cadena)) !== null) {
        encontradas.push({
            texto: coincidencia[0],
            inicio: coincidencia.index,
            fin: coincidencia.index + coincidencia[0].length,
        });
    }

    return encontradas;
}
