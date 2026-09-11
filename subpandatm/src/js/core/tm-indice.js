/**
 * El índice de la memoria de traducción.
 *
 * El problema: para saber qué unidades se parecen al segmento que se tiene
 * delante, Poanda las comparaba TODAS, una por una, con el cálculo caro. Con
 * 20.000 unidades eso son un par de segundos de pantalla congelada cada vez que
 * se pasa de segmento, y una memoria profesional tiene bastantes más.
 *
 * La solución es la de siempre en las herramientas de traducción, y es la misma
 * que usa cualquier buscador: **antes de comparar, preguntar quién puede llegar
 * a parecerse**. Se apunta, para cada trozo de palabra, en qué unidades sale.
 * Al llegar a un segmento se miran sus trozos, se cuenta cuántos comparte cada
 * unidad, y solo se comparan de verdad las que comparten más. Las demás no se
 * tocan: si una unidad no tiene ni una palabra en común con lo que se está
 * traduciendo, no hace falta el cálculo caro para saber que no sirve.
 *
 * Por qué trozos de palabra y no palabras enteras: "correr", "corriendo" y
 * "corrimos" son la misma palabra para quien traduce y tres palabras distintas
 * para un índice. Cortando por las primeras letras, las tres caen en el mismo
 * sitio y la unidad guardada aparece igual.
 *
 * Lo que este módulo NO hace: decidir. Solo propone candidatas. Quién se lleva
 * el porcentaje y quién se enseña lo sigue decidiendo el cálculo de siempre,
 * exactamente igual que antes.
 */

/**
 * A partir de cuántas unidades compensa el índice.
 *
 * Por debajo, comparar la memoria entera cuesta unas décimas y el índice solo
 * añadiría una manera nueva de equivocarse. Una memoria de proyecto —la que se
 * llena sola traduciendo— casi nunca pasa de aquí, así que en el uso normal
 * este módulo ni se despierta.
 */
export const DESDE_CUANTAS_UNIDADES = 3000;

/** Cuántas letras de cada palabra entran en el índice. */
const LETRAS_DE_LA_CLAVE = 4;

/**
 * Cuántas candidatas se llevan al cálculo caro.
 *
 * Se enseñan cinco coincidencias. Doscientas candidatas es un margen amplio
 * para que la buena esté entre ellas incluso cuando comparte pocas palabras, y
 * sigue siendo cien veces menos trabajo que recorrer la memoria entera.
 */
export const CANDIDATAS = 200;

/**
 * Cuántas apariciones se está dispuesto a recorrer para proponer candidatas.
 *
 * Las palabras del segmento no valen todas lo mismo. "the" sale en casi todas
 * las unidades y no distingue nada; "arbitraje" sale en tres y las señala con
 * el dedo. Así que se miran de la más rara a la más común y se para al llegar a
 * este presupuesto: se paga por lo que informa y no por lo que no.
 *
 * Ojo con la tentación de tirar directamente las palabras muy frecuentes: en
 * una memoria repetitiva —un manual con miles de frases casi iguales— TODAS lo
 * son, y descartándolas la lista de candidatas se quedaba vacía y la memoria
 * dejaba de proponer nada. Por eso aquí no se descarta ninguna: se ordenan, y
 * siempre se mira al menos la más rara.
 */
const PRESUPUESTO_DE_APARICIONES = 20000;

/**
 * Los trozos de palabra de un texto, sin repetir.
 *
 * @param {string} texto
 * @returns {string[]}
 */
export function clavesDelTexto(texto) {
    const limpio = String(texto ?? '').toLowerCase();
    if (!limpio.trim()) return [];

    const claves = new Set();
    // Se parte por lo que no es letra ni número, así los signos, las etiquetas y
    // los espacios dobles dan igual.
    for (const palabra of limpio.split(/[^\p{L}\p{N}]+/u)) {
        if (!palabra) continue;
        claves.add(palabra.slice(0, LETRAS_DE_LA_CLAVE));
    }
    return [...claves];
}

/**
 * Construye el índice de una memoria.
 *
 * @param {Array<{srcText?: string}>} unidades
 * @returns {{porClave: Map<string, number[]>, total: number}}
 */
export function construirIndice(unidades = []) {
    const porClave = new Map();
    const total = unidades.length;

    for (let i = 0; i < total; i++) {
        for (const clave of clavesDelTexto(unidades[i]?.srcText)) {
            let lista = porClave.get(clave);
            if (!lista) {
                lista = [];
                porClave.set(clave, lista);
            }
            lista.push(i);
        }
    }

    return { porClave, total };
}

/**
 * Qué unidades merece la pena comparar con este texto.
 *
 * Devuelve posiciones dentro de la memoria, de la que más trozos comparte a la
 * que menos. Si el texto no comparte nada con nadie, devuelve una lista vacía:
 * eso significa que no hay coincidencias, y es la respuesta correcta.
 *
 * @param {{porClave: Map<string, number[]>}} indice
 * @param {string} texto
 * @param {{maximo?: number, presupuesto?: number}} [limites]
 * @returns {number[]} Posiciones en la memoria.
 */
export function candidatas(
    indice,
    texto,
    { maximo = CANDIDATAS, presupuesto = PRESUPUESTO_DE_APARICIONES } = {},
) {
    if (!indice?.porClave) return [];

    // De la palabra más rara a la más común: las raras son las que dicen algo.
    const listas = [];
    for (const clave of clavesDelTexto(texto)) {
        const lista = indice.porClave.get(clave);
        if (lista) listas.push(lista);
    }
    if (listas.length === 0) return [];
    listas.sort((a, b) => a.length - b.length);

    const cuenta = new Map();
    let gastado = 0;
    for (const lista of listas) {
        // Siempre se mira al menos la primera, por rara que sea la palabra o por
        // larga que sea su lista: sin eso una memoria repetitiva no propondría
        // nada, que es peor que ir lenta.
        if (gastado > 0 && gastado + lista.length > presupuesto) break;
        gastado += lista.length;
        for (const posicion of lista) {
            cuenta.set(posicion, (cuenta.get(posicion) || 0) + 1);
        }
    }
    if (cuenta.size === 0) return [];

    const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
    return orden.slice(0, maximo).map(([posicion]) => posicion);
}
