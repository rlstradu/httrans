/**
 * Cuenta las palabras de un texto.
 *
 * Cuenta separando por espacios en blanco, que es el criterio habitual en las
 * herramientas de traducción para dar el volumen de un archivo.
 *
 * @param {string} text Texto a contar.
 * @returns {number} Número de palabras; 0 si el texto está vacío.
 */
function countWords(text) {
    if (!text) return 0;
    // Trim leading/trailing whitespace and split by one or more whitespace characters
    const words = text.trim().split(/\s+/);
    // Filter out empty strings that might result from multiple spaces
    return words.filter((word) => word.length > 0).length;
}

/**
 * Parte un texto en frases, conservando los signos de puntuación finales.
 *
 * @param {string} text Texto a partir.
 * @returns {string[]} Lista de frases. Para un texto vacío devuelve [''].
 */
function splitTextIntoSentences(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return [''];
    }
    // Use a regex that keeps the delimiters to re-assemble them correctly
    const sentenceDelimiters = /([.?!]+[\s\r\n]*)/g;
    const parts = text.split(sentenceDelimiters);

    const sentences = [];
    let currentSentence = '';

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === null || part === undefined) continue;

        if (part.match(sentenceDelimiters)) {
            // If it's a delimiter
            if (currentSentence.trim() !== '') {
                sentences.push(currentSentence.trim() + part);
                currentSentence = '';
            } else if (part.trim() !== '') {
                // Handle cases where a delimiter might start a segment
                sentences.push(part.trim());
            }
        } else {
            // If it's a sentence part
            currentSentence += part;
        }
    }
    if (currentSentence.trim() !== '') {
        sentences.push(currentSentence.trim());
    }

    return sentences.filter((s) => s.length > 0 || text === '');
}

/**
 * Distancia de Levenshtein entre dos cadenas: cuántas letras hay que insertar,
 * borrar o cambiar para convertir una en la otra.
 *
 * Es la base del cálculo de coincidencias parciales de la memoria de traducción.
 *
 * @param {string} a Primera cadena.
 * @param {string} b Segunda cadena.
 * @returns {number} Número de operaciones necesarias.
 */
function levenshteinDistance(a, b) {
    const an = a.length;
    const bn = b.length;
    if (an === 0) return bn;
    if (bn === 0) return an;

    const matrix = [];

    for (let i = 0; i <= bn; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= an; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= bn; i++) {
        for (let j = 1; j <= an; j++) {
            const cost = a[j - 1] === b[i - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost,
            );
        }
    }
    return matrix[bn][an];
}

/**
 * Porcentaje de parecido entre dos textos, del 0 al 100.
 *
 * Es lo que se muestra como "coincidencia" en la memoria de traducción: 100
 * significa idénticos, 0 que no se parecen en nada.
 *
 * @param {string} s1 Primer texto.
 * @param {string} s2 Segundo texto.
 * @returns {number} Porcentaje entre 0 y 100; 0 si falta alguno de los dos.
 */
function calculateSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    const longerLength = Math.max(s1.length, s2.length);
    if (longerLength === 0) return 100;
    const distance = levenshteinDistance(s1, s2);
    return ((longerLength - distance) / longerLength) * 100;
}

/**
 * Longitud a partir de la cual se da por hecho que una línea se cortó sola.
 *
 * El CHANGELOG.md está escrito a unas 78 columnas. Una línea que llega cerca de
 * ese ancho se cortó porque no cabía la palabra siguiente, así que el párrafo
 * continúa. Una línea claramente más corta es un título o el final del párrafo.
 */
const ANCHO_LINEA_LLENA = 60;

/** Marcas de lista: nunca se pegan al párrafo anterior. */
const INICIO_DE_LISTA = /^\s*([*\-•+]|\d+[.)])\s/;

/**
 * Quita los saltos de línea que solo daban forma al archivo.
 *
 * El changelog se escribe con saltos duros para poder leerlo en un editor de
 * texto. Al enseñarlo en una ventana más estrecha, el navegador vuelve a partir
 * esas líneas y el resultado son renglones sueltos de una o dos palabras. Aquí
 * se unen las líneas de cada párrafo y se deja que sea el navegador quien
 * decida dónde cortar, que para eso sabe lo ancha que es la ventana.
 *
 * Se conservan los saltos que sí significan algo: líneas en blanco, líneas de
 * guiones o iguales, títulos de sección, listas y líneas sangradas.
 *
 * @param {string} texto Texto tal cual viene del archivo.
 * @returns {string} El mismo texto con los párrafos en una sola línea.
 */
function desenvolverParrafos(texto) {
    if (!texto) return '';

    const lineas = texto.split('\n');
    const salida = [];

    for (const linea of lineas) {
        const anterior = salida.length > 0 ? salida[salida.length - 1] : null;

        if (anterior !== null && continuaElParrafo(anterior, linea)) {
            salida[salida.length - 1] = `${anterior.replace(/\s+$/, '')} ${linea.trim()}`;
        } else {
            salida.push(linea);
        }
    }

    return salida.join('\n');
}

/**
 * ¿La segunda línea es continuación de la primera, o empieza algo nuevo?
 *
 * @param {string} anterior
 * @param {string} actual
 * @returns {boolean}
 */
function continuaElParrafo(anterior, actual) {
    // Nada que unir si alguna de las dos está vacía: ahí hay un párrafo aparte.
    if (!anterior.trim() || !actual.trim()) return false;

    // Las líneas de guiones o iguales enmarcan los títulos de versión.
    if (/^[=\-_*]{3,}\s*$/.test(anterior) || /^[=\-_*]{3,}\s*$/.test(actual)) return false;

    // Una línea sangrada o con marca de lista empieza algo por su cuenta.
    if (/^\s/.test(actual) || INICIO_DE_LISTA.test(actual)) return false;
    if (INICIO_DE_LISTA.test(anterior)) return false;

    // "New Features:" es un encabezado, no el principio de la frase siguiente.
    if (/:\s*$/.test(anterior)) return false;

    // Y ahora lo de siempre: si la línea anterior venía llena, se cortó sola.
    if (anterior.trim().length >= ANCHO_LINEA_LLENA) return true;

    // Si venía corta, todavía puede ser continuación: se nota en que la
    // siguiente empieza en minúscula o por un signo de puntuación, cosa que no
    // hace nunca un título.
    return /^[a-záéíóúüñ(),;:"'»–—-]/.test(actual);
}

export {
    calculateSimilarity,
    countWords,
    desenvolverParrafos,
    levenshteinDistance,
    splitTextIntoSentences,
};
