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
 * Cuántas formas de plural declara la cabecera del archivo.
 *
 * La cabecera de un PO trae una línea como
 * "Plural-Forms: nplurals=2; plural=(n != 1);". El número depende del idioma de
 * destino: una en japonés y chino, dos en español e inglés, tres en polaco,
 * seis en árabe. Por eso no se puede dar por supuesto.
 *
 * @param {string|undefined} cabecera Contenido del msgstr de la cabecera.
 * @returns {number|null} El número declarado, o null si no lo dice.
 */
function leerNPlurales(cabecera) {
    const encontrado = String(cabecera || '').match(/nplurals\s*=\s*(\d+)/i);
    if (!encontrado) return null;

    const cuantas = parseInt(encontrado[1], 10);
    // Un número absurdo en la cabecera no puede acabar en mil cuadros de texto.
    return cuantas > 0 && cuantas <= 10 ? cuantas : null;
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

    /**
     * Dónde va a parar una línea de continuación.
     *
     * En un archivo PO una cadena entre comillas en su propia línea continúa el
     * último campo que se abrió. Antes esto se resolvía con el nombre del campo
     * (`entrada[campoAbierto] += ...`), pero las formas de plural no viven en un
     * campo: viven en una posición de una lista (msgstr[0], msgstr[1]). Guardar
     * aquí una función en lugar de un nombre sirve para los dos casos.
     *
     * @type {((texto: string) => void)|null}
     */
    let continuarCampo = null;

    /** Prepara el campo `nombre` para recibir continuaciones. */
    const abrirCampo = (nombre) => {
        continuarCampo = (texto) => {
            entrada[nombre] = (entrada[nombre] || '') + texto;
        };
    };

    /** Cierra el segmento en curso y lo añade a la lista si tiene contenido. */
    const cerrarEntrada = () => {
        if (entrada && (entrada.msgid !== undefined || entrada.msgctxt !== undefined)) {
            // Una entrada con plural no lleva msgstr suelto: sus traducciones
            // están en msgstrPlural. Ponerle uno vacío dejaría el archivo
            // inválido para gettext al volver a escribirlo.
            if (entrada.msgstr === undefined && entrada.msgstrPlural === undefined) {
                entrada.msgstr = '';
            }
            entries.push(entrada);
        }
        entrada = null;
        continuarCampo = null;
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
            abrirCampo('msgctxt');
            continue;
        }

        // Va antes que msgid: "msgid_plural" también empieza por "msgid".
        if (linea.startsWith('msgid_plural ')) {
            abrirEntrada().msgidPlural = unescapePoString(linea.substring(13).trim());
            abrirCampo('msgidPlural');
            continue;
        }

        if (linea.startsWith('msgid ')) {
            if (entrada && entrada.msgid !== undefined) {
                cerrarEntrada();
            }
            abrirEntrada().msgid = unescapePoString(linea.substring(6).trim());
            abrirCampo('msgid');
            continue;
        }

        // Una forma de plural: msgstr[0], msgstr[1]...
        const formaPlural = linea.match(/^msgstr\[(\d+)\]\s*(.*)$/);
        if (formaPlural) {
            const indice = parseInt(formaPlural[1], 10);
            const actual = abrirEntrada();
            if (!actual.msgstrPlural) actual.msgstrPlural = [];
            actual.msgstrPlural[indice] = unescapePoString(formaPlural[2].trim());
            continuarCampo = (texto) => {
                actual.msgstrPlural[indice] = (actual.msgstrPlural[indice] || '') + texto;
            };
            continue;
        }

        if (linea.startsWith('msgstr ')) {
            abrirEntrada().msgstr = unescapePoString(linea.substring(7).trim());
            abrirCampo('msgstr');
            continue;
        }

        if (linea.startsWith('"')) {
            // Continuación del último campo abierto.
            if (entrada && continuarCampo) {
                continuarCampo(unescapePoString(linea));
            }
            continue;
        }

        // Cualquier otra cosa: deja de acumular en el campo anterior para no
        // mezclar lo que venga después con lo que había.
        continuarCampo = null;
    }

    cerrarEntrada();

    // Cuántas formas de plural tiene el idioma de destino. Lo dice la cabecera,
    // y hace falta saberlo antes de repartir los segmentos.
    const formasDeclaradas = leerNPlurales(
        entries.find((e) => e.msgid === '' && e.msgctxt === undefined)?.msgstr,
    );

    // Post-processing for sentence segmentation, word counts, and translation status
    entries.forEach((entry) => {
        // Entradas con plural: una fila por forma, cada una con el original que
        // le toca (el singular la primera, el plural las demás). Aquí no se
        // parte por frases: cada forma es una unidad y punto.
        if (entry.msgidPlural !== undefined) {
            entry.isHeader = false;

            const traducciones = entry.msgstrPlural || [];
            // Si la cabecera declara cuántas formas hay, se abren todas: a un
            // archivo al que le falte una hay que poder rellenársela. Sin
            // cabecera no se inventa ninguna, porque añadir una forma de más a
            // un idioma que solo tiene una (japonés, chino) rompe el archivo.
            const cuantas = formasDeclaradas || Math.max(1, traducciones.length);

            entry.sentenceSegments = [];
            for (let i = 0; i < cuantas; i++) {
                const original = i === 0 ? entry.msgid || '' : entry.msgidPlural;
                const traduccion = traducciones[i] || '';
                entry.sentenceSegments.push({
                    original,
                    translation: traduccion,
                    wordCountOriginal: countWords(original),
                    wordCountTranslation: countWords(traduccion),
                    isTranslated: traduccion.trim() !== '',
                    formaPlural: i,
                });
            }
            return;
        }

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
            // La marca de provisional se quita en cuanto hay traducción. Con
            // plurales basta con que la tenga alguna de las formas.
            const hayTraduccion =
                entry.msgidPlural !== undefined
                    ? (entry.sentenceSegments || []).some((s) => (s.translation || '').trim() !== '')
                    : Boolean(entry.msgstr && entry.msgstr.trim() !== '');

            const commentsToKeep =
                entry.fuzzy && hayTraduccion
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

        // Entradas con plural: el original plural y una traducción por forma, en
        // el orden que exige el formato (msgid, msgid_plural, msgstr[0], [1]...).
        // Aquí no se escribe un msgstr suelto: los dos juntos dejan el archivo
        // inválido para gettext.
        if (entry.msgidPlural !== undefined) {
            poContent += escribirCampoPo('msgid_plural', entry.msgidPlural);
            (entry.sentenceSegments || []).forEach((segmento, i) => {
                poContent += escribirCampoPo(`msgstr[${i}]`, segmento.translation || '');
            });
            poContent += '\n';
            return;
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
