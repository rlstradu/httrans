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

export { calculateSimilarity, countWords, levenshteinDistance, splitTextIntoSentences };
