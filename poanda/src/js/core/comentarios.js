/**
 * Los comentarios de un segmento no son todos la misma cosa.
 *
 * En un archivo PO conviven varios tipos, y gettext los distingue por la marca
 * que llevan detrás de la almohadilla:
 *
 *   #: templates/home.html:42   dónde vive la cadena en el código
 *   #. Máximo 20 caracteres     nota del programador para quien traduce
 *   # Ojo con el tuteo          nota de quien tradujo antes
 *   #, fuzzy                    marcas del formato
 *   #| msgid "..."              el original anterior, de cuando se marcó fuzzy
 *   #~ msgid "..."              cadena retirada
 *
 * Mezclarlos todos en la misma etiqueta era un error: **la referencia identifica
 * el segmento y la nota te dice cómo traducirlo**, y son dos necesidades
 * distintas. La referencia se lee de un vistazo para ubicarte; la nota hay que
 * leerla entera y solo la tienen unos pocos segmentos.
 *
 * Así que se reparten: las referencias van a la etiqueta gris de encima del
 * segmento y las notas al icono de comentario que hay junto a copiar el
 * original, que se enciende cuando hay algo que leer.
 *
 * Las marcas del formato (fuzzy, el original anterior, las cadenas retiradas) no
 * van a ninguno de los dos: son sintaxis del archivo. La de fuzzy ya tiene su
 * propia insignia en el segmento.
 */

/** Referencias al código: dónde aparece la cadena. */
const ES_REFERENCIA = /^#:/;

/** Marcas del propio formato, que no son ni referencia ni nota. */
const ES_MARCA_DEL_FORMATO = /^#[,|~]/;

/** Nota del programador (#.) o de quien tradujo antes (# a secas, o ! en .properties). */
const ES_NOTA = /^(#\.|#(?![:.,|~])|!)/;

/**
 * Reparte los comentarios de una entrada en referencias y notas.
 *
 * @param {Array<string>} comentarios Líneas tal y como vienen del archivo.
 * @returns {{referencias: string[], notas: string[]}} Ya sin la marca de
 *   delante: lo que se enseña es lo que dicen, no cómo están escritos.
 */
export function repartirComentarios(comentarios) {
    const referencias = [];
    const notas = [];

    for (const linea of comentarios || []) {
        const texto = String(linea ?? '').trim();
        if (!texto) continue;

        if (ES_REFERENCIA.test(texto)) {
            referencias.push(limpiar(texto));
        } else if (ES_MARCA_DEL_FORMATO.test(texto)) {
            // Sintaxis del archivo: no se enseña.
        } else if (ES_NOTA.test(texto)) {
            const contenido = limpiar(texto);
            if (contenido) notas.push(contenido);
        }
    }

    return { referencias, notas };
}

/**
 * Quita la marca de delante y los espacios que la sigan.
 *
 * @param {string} linea
 * @returns {string}
 */
function limpiar(linea) {
    return linea.replace(/^(#[.:,|~]?|!)\s*/, '').trim();
}
