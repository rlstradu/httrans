import { countWords } from './text.js';

/**
 * Lee un archivo JSON de clave-valor y lo convierte en segmentos traducibles.
 *
 * La clave del JSON pasa a ser el contexto (msgctxt) y el valor, el texto
 * original (msgid). La traducción queda vacía para rellenar.
 *
 * @param {string} jsonContent Contenido del archivo JSON.
 * @returns {Array<Object>} Segmentos listos para el editor.
 */
function parseJsonProject(jsonContent) {
    const jsonData = JSON.parse(jsonContent);
    const entries = [];
    const sortedKeys = Object.keys(jsonData).sort(); // Sort keys

    for (const key of sortedKeys) {
        if (Object.hasOwnProperty.call(jsonData, key)) {
            const value = String(jsonData[key] || ''); // Ensure it's a string

            const entry = {
                comments: [],
                msgctxt: key, // Key -> Context
                msgid: value, // Value -> Original (for reference)
                msgstr: '', // <-- CAMBIADO a cadena vacía
                isHeader: false,
                fuzzy: false,
                sentenceSegments: [
                    {
                        // Maintain segment structure
                        original: value, // Value goes here too
                        translation: '', // <-- CAMBIADO a cadena vacía
                        wordCountOriginal: countWords(value),
                        wordCountTranslation: 0, // <-- CAMBIADO a 0
                        isTranslated: false, // <-- CAMBIADO a false
                    },
                ],
            };
            entries.push(entry);
        }
    }
    return entries;
}

/**
 * Reconstruye un archivo JSON de clave-valor a partir de los segmentos.
 *
 * @param {Array<Object>} entries Segmentos del editor.
 * @returns {string} JSON con formato, listo para guardar.
 */
function reconstructJson(entries) {
    const translations = {};
    entries.forEach((entry) => {
        // Only process entries that likely came from JSON (have msgctxt)
        if (entry.msgctxt && !entry.isHeader) {
            // Reconstruct the full translation string from segments
            const fullMsgstr = (entry.sentenceSegments || [])
                .map((s) => s.translation || '') // Ensure segments exist
                .join(' ') // Join segments back (simple join, might need refinement for complex cases)
                .trim();
            translations[entry.msgctxt] = fullMsgstr;
        }
    });
    return JSON.stringify(translations, null, 2); // Pretty print JSON
}

export { parseJsonProject, reconstructJson };
