/**
 * Qué coincidencias de la memoria merece la pena enseñar, y con qué categoría.
 *
 * Una memoria de traducción devuelve un parecido para CADA unidad que tiene
 * dentro; casi todos esos parecidos son ruido. Poanda las enseñaba todas, así
 * que con una memoria de trabajo aparecían coincidencias del 12 % —dos frases
 * que no tienen nada que ver salvo que ambas usan la letra "a"— con un diff
 * entre ellas que era literalmente confeti rojo y verde.
 *
 * Los dos números de aquí abajo son los mismos que usa Locversia, la otra
 * herramienta del proyecto que tiene memoria: por debajo del 50 % una
 * coincidencia no ayuda a traducir, y más de cinco no caben en una columna sin
 * enterrar la que sí vale, que es siempre la primera.
 */

/** Por debajo de esto, una coincidencia estorba más de lo que ayuda. */
export const MINIMO_PARA_ENSENAR = 50;

/** Cuántas se enseñan como mucho. */
export const MAXIMO_RESULTADOS = 5;

/**
 * Cuántas se enseñan al buscar una palabra en la memoria.
 *
 * Buscando no hay parecido que ordene: valen todas las que contengan lo
 * escrito. Sobre una memoria de verdad, buscar "the" son decenas de miles de
 * unidades, y pintarlas cuelga el navegador. Veinte es lo que se mira de una
 * vez antes de afinar la búsqueda.
 */
export const MAXIMO_CONCORDANCIAS = 20;

/**
 * La categoría de una coincidencia según lo que se parece.
 *
 * Los nombres son los de siempre en las herramientas de traducción, y cada uno
 * dice algo distinto sobre qué hacer con ella:
 *
 * - `exacta`: el original es idéntico. Se puede insertar sin mirar.
 * - `alta`: cambia un detalle. Se inserta y se repasa esa parte.
 * - `media`: se parece de verdad, pero hay que trabajarla.
 * - `baja`: sirve para ver cómo se resolvió algo parecido, poco más.
 *
 * @param {number} puntuacion De 0 a 100.
 * @returns {'exacta'|'alta'|'media'|'baja'}
 */
export function bandaDeCoincidencia(puntuacion) {
    const n = Number(puntuacion) || 0;
    if (n >= 100) return 'exacta';
    if (n >= 95) return 'alta';
    if (n >= 75) return 'media';
    return 'baja';
}

/**
 * Deja solo las coincidencias que valen algo, de mejor a peor.
 *
 * @param {Array<{score: number|string}>} coincidencias
 * @param {{minimo?: number, maximo?: number}} [limites]
 * @returns {Array<object>}
 */
export function coincidenciasQueValen(
    coincidencias = [],
    { minimo = MINIMO_PARA_ENSENAR, maximo = MAXIMO_RESULTADOS } = {},
) {
    return coincidencias
        .filter((c) => Number(c.score) >= minimo)
        .sort((a, b) => Number(b.score) - Number(a.score))
        .slice(0, maximo);
}
