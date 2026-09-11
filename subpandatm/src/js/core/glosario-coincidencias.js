/**
 * Qué términos del glosario enseña el panel, y en qué orden.
 *
 * El panel enseñaba el glosario entero en una tabla de tres columnas: lo mismo
 * con un segmento delante que con otro. Con veinte términos, encontrar el que
 * hace al caso era ir leyendo la lista, que es justo el trabajo que el glosario
 * viene a ahorrar.
 *
 * Lo que se enseña ahora son las coincidencias del segmento en el que se está,
 * como en Locversia: los términos que aparecen de verdad en el texto que se
 * tiene delante. Para ver el resto está el buscador de los paneles, que sigue
 * mirando también dentro de las definiciones y las notas.
 *
 * Aquí solo está la parte que se puede probar sin navegador: buscar, ordenar y
 * recortar. El pintado vive en glossary.js.
 */

/** Cuántas coincidencias caben en la columna sin enterrar las primeras. */
export const MAXIMO_TERMINOS = 5;

/** Escapa lo que en una expresión regular significaría otra cosa. */
const literal = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Los términos del glosario que aparecen en un texto.
 *
 * De más largo a más corto: si el glosario tiene "file" y "file name", en "the
 * file name is wrong" gana la expresión entera, que es la que alguien se tomó
 * la molestia de guardar. Se busca por palabras completas, para que "art" no
 * salte dentro de "start".
 *
 * Aviso conocido, el mismo que tiene el resaltado del editor: un término que
 * termina en un signo ("C++") no se encuentra, porque el límite de palabra
 * necesita una letra a un lado. Arreglarlo pide expresiones con lookbehind, que
 * dejan fuera a los Safari anteriores a 2023.
 *
 * @param {Array<{srcTerm?: string}>} glosario
 * @param {string} texto El original del segmento.
 * @returns {Array<object>} Las entradas encontradas, sin repetir.
 */
export function terminosEnElTexto(glosario = [], texto = '') {
    const original = String(texto ?? '');
    if (!original.trim()) return [];

    const candidatos = (glosario || [])
        .filter((entrada) => (entrada?.srcTerm || '').trim())
        .sort((a, b) => b.srcTerm.length - a.srcTerm.length);
    if (candidatos.length === 0) return [];

    // Un solo barrido con todas las alternativas: buscar término a término
    // volvería a encontrar "file" dentro de un "file name" ya encontrado.
    const porTexto = new Map();
    const alternativas = [];
    for (const entrada of candidatos) {
        const clave = entrada.srcTerm.toLowerCase();
        if (porTexto.has(clave)) continue;
        porTexto.set(clave, entrada);
        alternativas.push(literal(entrada.srcTerm));
    }

    const busca = new RegExp(`\\b(${alternativas.join('|')})\\b`, 'gi');
    const encontradas = [];
    const yaEsta = new Set();
    let hallazgo;
    while ((hallazgo = busca.exec(original)) !== null) {
        const entrada = porTexto.get(hallazgo[0].toLowerCase());
        if (!entrada) continue;
        const clave = entrada.srcTerm.toLowerCase();
        if (yaEsta.has(clave)) continue;
        yaEsta.add(clave);
        encontradas.push(entrada);
    }

    return encontradas;
}

/**
 * Las coincidencias que enseña el panel para un segmento.
 *
 * Van de más larga a más corta: la expresión de varias palabras dice más que
 * una palabra suelta, y es la que se corre el riesgo de traducir por libre.
 *
 * @param {Array<object>} glosario
 * @param {string} texto
 * @param {{maximo?: number}} [limites]
 * @returns {Array<object>}
 */
export function coincidenciasDelSegmento(glosario = [], texto = '', { maximo = MAXIMO_TERMINOS } = {}) {
    return terminosEnElTexto(glosario, texto)
        .sort((a, b) => (b.srcTerm?.length || 0) - (a.srcTerm?.length || 0))
        .slice(0, maximo);
}

/**
 * Los términos que responden a lo escrito en el buscador.
 *
 * Se mira también en la definición y en las notas: si alguien apuntó "no
 * traducir como fichero", buscar "fichero" tiene que llevar hasta ese término,
 * que es justo para lo que se escribió la nota.
 *
 * @param {Array<object>} glosario
 * @param {string} buscado
 * @returns {Array<object>}
 */
export function terminosQueResponden(glosario = [], buscado = '') {
    const aguja = String(buscado ?? '').trim().toLowerCase();
    if (!aguja) return [];

    return (glosario || [])
        .filter((entrada) =>
            ['srcTerm', 'tgtTerm', 'definition', 'notes'].some((campo) =>
                (entrada?.[campo] || '').toLowerCase().includes(aguja),
            ),
        )
        .sort((a, b) => (a.srcTerm || '').localeCompare(b.srcTerm || ''));
}
