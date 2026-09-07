import { countWords } from './text.js';

/**
 * Convierte una cadena tal y como aparece en un archivo PO al texto real.
 *
 * Quita las comillas que la envuelven y deshace los escapes (\n, \t, \", \\).
 * También convierte las etiquetas <br> en saltos de línea reales.
 *
 * @param {string} s Cadena tal cual viene del archivo PO.
 * @returns {string} Texto legible.
 */
function unescapePoString(s) {
    if (s.startsWith('"') && s.endsWith('"')) {
        s = s.substring(1, s.length - 1);
    }
    s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    s = s.replace(/&lt;br&gt;/gi, '\n');
    s = s.replace(/<br\s*\/?>/gi, '\n');

    return s;
}

/**
 * Convierte un texto al formato que exige un archivo PO.
 *
 * Es la operación inversa de unescapePoString: escapa barras, comillas,
 * saltos de línea y tabuladores, y envuelve el resultado entre comillas.
 *
 * @param {string} s Texto real.
 * @returns {string} Cadena lista para escribir en un archivo PO, con comillas.
 */
function escapePoString(s) {
    let escaped = s
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t');
    return `"${escaped}"`;
}

/**
 * Indica si una línea de comentario marca el segmento como "fuzzy"
 * (traducción provisional que gettext señala para revisar).
 *
 * @param {string} comentario Línea de comentario, con su almohadilla.
 * @returns {boolean}
 */
function esComentarioFuzzy(comentario) {
    return /^#,/.test(comentario) && /\bfuzzy\b/.test(comentario);
}

/**
 * Lee el contenido de un archivo PO y lo convierte en una lista de segmentos.
 *
 * Reconoce comentarios (incluida la marca "fuzzy"), contexto (msgctxt), texto
 * original (msgid), traducción (msgstr) y las cadenas repartidas en varias
 * líneas, como la cabecera del archivo.
 *
 * En un archivo PO los comentarios van SIEMPRE delante del segmento al que
 * describen, así que se van acumulando aparte y se entregan al siguiente
 * segmento que empieza. Una cadena entre comillas en su propia línea continúa
 * el último campo abierto (msgid, msgstr o msgctxt).
 *
 * @param {string} content Contenido completo del archivo PO.
 * @returns {Array<Object>} Segmentos con msgid, msgstr, msgctxt, comments,
 *   fuzzy, isHeader, wordCount y sentenceSegments.
 */
function parsePoContent(content) {
    const entries = [];
    const lines = content.split('\n');

    let comentariosPendientes = [];
    let entrada = null;
    let campoAbierto = null; // 'msgid' | 'msgstr' | 'msgctxt'

    /** Cierra el segmento en curso y lo añade a la lista si tiene contenido. */
    const cerrarEntrada = () => {
        if (entrada && (entrada.msgid !== undefined || entrada.msgctxt !== undefined)) {
            if (entrada.msgstr === undefined) entrada.msgstr = '';
            entries.push(entrada);
        }
        entrada = null;
        campoAbierto = null;
    };

    /** Abre un segmento nuevo y le entrega los comentarios acumulados. */
    const abrirEntrada = () => {
        if (!entrada) {
            entrada = { comments: comentariosPendientes };
            if (comentariosPendientes.some(esComentarioFuzzy)) {
                entrada.fuzzy = true;
            }
            comentariosPendientes = [];
        }
        return entrada;
    };

    for (const lineaCruda of lines) {
        const linea = lineaCruda.trim();

        if (linea === '') {
            cerrarEntrada();
            continue;
        }

        if (linea.startsWith('#')) {
            // Un comentario abre siempre un bloque nuevo: cierra el anterior.
            cerrarEntrada();
            comentariosPendientes.push(linea);
            continue;
        }

        if (linea.startsWith('msgctxt ')) {
            if (entrada && (entrada.msgid !== undefined || entrada.msgctxt !== undefined)) {
                cerrarEntrada();
            }
            abrirEntrada().msgctxt = unescapePoString(linea.substring(8).trim());
            campoAbierto = 'msgctxt';
            continue;
        }

        if (linea.startsWith('msgid ')) {
            if (entrada && entrada.msgid !== undefined) {
                cerrarEntrada();
            }
            abrirEntrada().msgid = unescapePoString(linea.substring(6).trim());
            campoAbierto = 'msgid';
            continue;
        }

        if (linea.startsWith('msgstr ')) {
            abrirEntrada().msgstr = unescapePoString(linea.substring(7).trim());
            campoAbierto = 'msgstr';
            continue;
        }

        if (linea.startsWith('"')) {
            // Continuación del último campo abierto.
            if (entrada && campoAbierto) {
                entrada[campoAbierto] = (entrada[campoAbierto] || '') + unescapePoString(linea);
            }
            continue;
        }

        // Cualquier otra cosa (msgid_plural, msgstr[0]...) todavía no se
        // interpreta; deja de acumular en el campo anterior para no mezclar.
        campoAbierto = null;
    }

    cerrarEntrada();

    // Post-processing for sentence segmentation, word counts, and translation status
    entries.forEach((entry) => {
        // Handle the special header entry (msgid "")
        if (entry.msgid === '' && entry.msgctxt === undefined) {
            entry.isHeader = true;
            entry.sentenceSegments = [
                {
                    original: entry.msgid,
                    translation: entry.msgstr,
                    wordCountOriginal: countWords(entry.msgid),
                    wordCountTranslation: countWords(entry.msgstr),
                    isTranslated: entry.msgstr.trim() !== '',
                },
            ];
        } else {
            entry.isHeader = false;
            // Deshabilitamos la segmentación por frases para evitar problemas de espacios
            const originalSegments = [entry.msgid || ''];
            const translatedSegments = [entry.msgstr || ''];

            entry.sentenceSegments = [];
            const maxLength = Math.max(originalSegments.length, translatedSegments.length);
            for (let j = 0; j < maxLength; j++) {
                const originalText = originalSegments[j] || '';
                const translationText = translatedSegments[j] || '';
                entry.sentenceSegments.push({
                    original: originalText,
                    translation: translationText,
                    wordCountOriginal: countWords(originalText),
                    wordCountTranslation: countWords(translationText),
                    isTranslated: translationText.trim() !== '',
                });
            }
        }
    });
    return entries;
}

/**
 * Escribe un campo de un archivo PO (msgid, msgstr o msgctxt).
 *
 * Cuando el texto contiene saltos de línea se reparte en varias líneas, que es
 * como lo escriben gettext y Poedit: una primera línea vacía y después un
 * trozo por línea. El resultado es equivalente para el programa que lo lea,
 * pero mucho más legible y con el aspecto que se espera de un archivo PO.
 *
 * @param {string} etiqueta Nombre del campo: 'msgid', 'msgstr' o 'msgctxt'.
 * @param {string} valor Texto del campo, ya sin escapar.
 * @returns {string} Una o varias líneas, terminadas en salto de línea.
 */
function escribirCampoPo(etiqueta, valor) {
    const texto = valor || '';
    if (!texto.includes('\n')) {
        return `${etiqueta} ${escapePoString(texto)}\n`;
    }

    // Se parte por el salto conservándolo al final de cada trozo.
    const trozos = texto
        .split('\n')
        .map((parte, i, todas) => (i < todas.length - 1 ? parte + '\n' : parte));
    if (trozos[trozos.length - 1] === '') trozos.pop();

    return `${etiqueta} ""\n` + trozos.map((t) => `${escapePoString(t)}\n`).join('');
}

/**
 * Vuelve a escribir un archivo PO a partir de la lista de segmentos.
 *
 * Es la operación inversa de parsePoContent. Si un segmento estaba marcado
 * como "fuzzy" y ya tiene traducción, la marca se elimina.
 *
 * @param {Array<Object>} entries Segmentos, tal y como los devuelve parsePoContent.
 * @returns {string} Contenido completo del archivo PO.
 */
function reconstructPo(entries) {
    let poContent = '';
    entries.forEach((entry) => {
        if (entry.comments && entry.comments.length > 0) {
            // Filter out fuzzy comment if msgstr is not empty
            const commentsToKeep =
                entry.fuzzy && entry.msgstr && entry.msgstr.trim() !== ''
                    ? entry.comments.filter((c) => !c.includes('#, fuzzy'))
                    : entry.comments;
            if (commentsToKeep.length > 0) {
                poContent += commentsToKeep.join('\n') + '\n';
            }
        }
        if (entry.msgctxt !== undefined) {
            poContent += escribirCampoPo('msgctxt', entry.msgctxt);
        }
        if (entry.msgid !== undefined) {
            poContent += escribirCampoPo('msgid', entry.msgid);
        }

        let fullMsgstr = '';
        if (entry.sentenceSegments && entry.sentenceSegments.length > 0) {
            // For header, directly use the stored msgstr
            if (entry.isHeader) {
                fullMsgstr = entry.msgstr || '';
            } else {
                // For regular entries, join segmented translations
                // Eliminamos el .trim() y unimos sin espacios extra para respetar el formato exacto del PO
                fullMsgstr = entry.sentenceSegments.map((s) => s.translation).join('');
            }
        } else {
            fullMsgstr = entry.msgstr || ''; // Fallback if no segments
        }

        if (fullMsgstr !== undefined) {
            poContent += escribirCampoPo('msgstr', fullMsgstr);
        }
        poContent += '\n';
    });
    // Cada segmento deja una línea en blanco detrás; la última sobra, porque el
    // archivo debe terminar con un único salto de línea.
    return poContent.replace(/\n+$/, '\n');
}

export { escapePoString, parsePoContent, reconstructPo, unescapePoString };
