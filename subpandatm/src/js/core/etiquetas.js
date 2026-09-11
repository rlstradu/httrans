/**
 * Vigilar que la traducción lleve el mismo formato que el original.
 *
 * En una herramienta con un `<textarea>` las etiquetas se ven como texto y el
 * peligro es partir una por la mitad. Aquí el campo es `contenteditable`: la
 * cursiva se ve en cursiva, no hay manera de dejarse un "<i" a medias y ese
 * peligro no existe. El que sí existe es el contrario, y no se ve al leer la
 * traducción: **que el formato se quede por el camino**. El original tenía una
 * palabra en cursiva —el título de una película, un pensamiento, un idioma
 * extranjero—, quien traduce escribe encima, y la cursiva desaparece sin que
 * nada avise. El archivo sale bien formado y con el formato mal.
 *
 * Por eso esto no compara etiquetas sino **lo que las etiquetas significan**. En
 * el editor la cursiva es `<i>`, en TTML es `<span tts:fontStyle="italic">` y en
 * un SRT vuelve a ser `<i>`: son la misma cursiva escrita de tres maneras, y
 * comparar el texto de la etiqueta daría un aviso falso en cada subtítulo de un
 * TTML.
 */

/** Las etiquetas de toda la vida y qué significan. */
const POR_SU_NOMBRE = {
    i: 'italic',
    em: 'italic',
    b: 'bold',
    strong: 'bold',
    u: 'underline',
};

/**
 * Cómo dice cada formato lo mismo. Se mira el atributo de TTML y, además, el
 * estilo en línea, que es lo que deja el navegador cuando se trabaja con
 * estilos en vez de con etiquetas.
 */
const POR_SUS_ATRIBUTOS = [
    { estilo: 'italic', busca: /tts:fontStyle\s*=\s*["']italic["']|font-style\s*:\s*italic/i },
    {
        estilo: 'bold',
        busca: /tts:fontWeight\s*=\s*["']bold["']|font-weight\s*:\s*(?:bold|[6-9]00)/i,
    },
    {
        estilo: 'underline',
        busca: /tts:textDecoration\s*=\s*["']underline["']|text-decoration\s*:\s*underline/i,
    },
    { estilo: 'color', busca: /tts:color\s*=|(?<!background-)\bcolor\s*=|(?<!background-)\bcolor\s*:/i },
];

/** Una etiqueta que abre: `<i>`, `<span …>`, `<font color="…">`. */
const QUE_ABRE = /<([a-z][\w.-]*(?::[\w.-]+)?)((?:\s[^<>]*)?)\/?>/gi;

/**
 * Los ocho colores que WebVTT trae de serie, más los que escribe subpandaTM.
 *
 * En WebVTT el color no es una etiqueta ni un atributo: es una clase pegada al
 * nombre, `<c.yellow>`. Pero no toda clase es un color —`<c.grito>` puede ser
 * cualquier cosa que el archivo defina en su cabecera—, así que solo cuentan
 * las que se sabe seguro que lo son. Marcar las demás daría un aviso falso en
 * cada subtítulo de un archivo con estilos propios.
 */
const CLASES_QUE_SON_COLOR =
    /^(?:white|lime|cyan|red|yellow|magenta|blue|black|color-[0-9a-f]{6})$/i;

/**
 * Una llave de ASS: `{\i1}`, `{\an8}`, `{\c&H00FFFF&}`, `{\i1\b1}`.
 *
 * En ASS el formato no son etiquetas sino marcas dentro del texto, así que
 * buscando "<" no se encuentra nada: este era el agujero por el que el aviso
 * de formato no saltaba **nunca** en un ASS.
 */
const LLAVE_DE_ASS = /\{([^{}]*)\}/g;

/**
 * Qué significa cada marca de dentro de una llave.
 *
 * El `1` del final es "ponlo" y el `0` es "quítalo", y solo cuenta el que lo
 * pone: `{\i0}` es cerrar una cursiva, no abrir otra. El color va con `\c` o
 * con `\1c`, que es lo mismo dicho de dos maneras.
 *
 * Lo que no está aquí no es formato del texto y no cuenta. La posición, sobre
 * todo: colocar un cartel arriba no es ponerlo en cursiva, y contarlo avisaría
 * en todos los carteles de un ASS sin que falte nada.
 */
const MARCAS_DE_ASS = [
    { estilo: 'italic', busca: /\\i1(?![0-9])/ },
    { estilo: 'bold', busca: /\\b1(?![0-9])/ },
    { estilo: 'underline', busca: /\\u1(?![0-9])/ },
    { estilo: 'color', busca: /\\(?:1)?c&H[0-9a-f]+&?/i },
];

/**
 * Qué formato lleva un texto, sin importar cómo esté escrito.
 *
 * @param {string} texto
 * @returns {string[]} Un nombre por cada trozo con formato, ordenados.
 */
export function estilosDe(texto) {
    const encontrados = [];

    for (const [, nombreEntero, atributos] of String(texto ?? '').matchAll(QUE_ABRE)) {
        const nombre = nombreEntero.replace(/^[\w.-]+:/, '').toLowerCase();

        if (POR_SU_NOMBRE[nombre]) {
            encontrados.push(POR_SU_NOMBRE[nombre]);
            continue;
        }

        // Quién habla, que en WebVTT es <v Ana> y no es adorno: es lo que hace
        // que el subtítulo salga del color de ese personaje.
        if (nombre === 'v') {
            encontrados.push('voz');
            continue;
        }

        // La clase de WebVTT va pegada al nombre con un punto: <c.yellow>. El
        // nombre entero llega aquí como "c.yellow", así que se parte.
        if (nombre.startsWith('c.')) {
            const esColor = nombre
                .split('.')
                .slice(1)
                .some((clase) => CLASES_QUE_SON_COLOR.test(clase));
            if (esColor) encontrados.push('color');
            continue;
        }

        for (const { estilo, busca } of POR_SUS_ATRIBUTOS) {
            if (busca.test(atributos)) encontrados.push(estilo);
        }
    }

    // Y ahora las llaves del ASS, que no son etiquetas y no las ve el bucle de
    // arriba. Una llave puede llevar varias marcas seguidas —{\i1\b1}—, así que
    // se miran todas dentro de cada una.
    for (const [, dentro] of String(texto ?? '').matchAll(LLAVE_DE_ASS)) {
        for (const { estilo, busca } of MARCAS_DE_ASS) {
            if (busca.test(dentro)) encontrados.push(estilo);
        }
    }

    return encontrados.sort();
}

/**
 * Compara el formato del original con el de la traducción.
 *
 * @param {string} original
 * @param {string} traduccion
 * @returns {{faltan: string[], sobran: string[]}} Vacíos los dos si cuadran.
 */
export function compararEtiquetas(original, traduccion) {
    // Sin traducir todavía no hay nada que comparar: un subtítulo en blanco no
    // es un subtítulo al que le falte la cursiva.
    if (!String(traduccion ?? '').replace(/<[^<>]*>/g, '').trim()) {
        return { faltan: [], sobran: [] };
    }

    const enElOriginal = estilosDe(original);
    const enLaTraduccion = estilosDe(traduccion);

    return {
        faltan: quitarUnoAUno(enElOriginal, enLaTraduccion),
        sobran: quitarUnoAUno(enLaTraduccion, enElOriginal),
    };
}

/**
 * Lo que hay en la primera lista y no en la segunda, contando repeticiones: dos
 * cursivas en el original y una en la traducción es una cursiva que falta.
 */
function quitarUnoAUno(unos, otros) {
    const quedan = [...otros];

    return unos.filter((estilo) => {
        const donde = quedan.indexOf(estilo);
        if (donde === -1) return true;
        quedan.splice(donde, 1);
        return false;
    });
}
