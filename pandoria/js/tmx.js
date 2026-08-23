// js/tmx.js
// TMX parsing, generation/download, file import, and the "paste code"
// import modal. See README.md's "Compatibility notes" section for the
// reasoning behind every fix below — each one was verified against the
// real TMX 1.4 DTD (xmllint) and/or against Subversia's own TMX
// parser/serializer (src/core/parsers/tmx.js), not just inferred.

// --- Carga y Parseo de Archivo TMX (Editor Principal) ---
function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target.result;
            parseTMX(content);
            historyStack = [];
            updateUndoButton();
            languageConfigSection.style.display = 'none';
            alignmentSection.classList.add('hidden');
            editorSection.classList.remove('hidden');
            renderTM(translationMemory, false);
            saveBackup();
        } catch (error) {
            showMessage(`${translations[currentLanguage]['error_processing_tmx']}${error.message}`);
            console.error(error);
            resetTM();
        }
    };
    reader.onerror = () => {
        showMessage(translations[currentLanguage]['error_reading_file']);
        resetTM();
    };
    reader.readAsText(file, 'UTF-8');
}

/**
 * Parses a TMX document into `translationMemory`.
 *
 * Language-code matching is case-insensitive. TMX language codes are
 * BCP-47 tags like "en-US", which are meant to be compared without
 * regard to case — but the original version used a strict `===` between
 * each <tuv xml:lang="..."> and the <header srclang="...">, so a TMX
 * file where the casing didn't match byte-for-byte (e.g. header says
 * "en-US" but a tuv says "EN-us", or the file was produced by a tool with
 * different casing conventions than Pandoria's own export) had its
 * entries silently dropped — no error, just fewer rows than expected.
 *
 * As a second safety net, if a <tu>'s language codes don't match the
 * header at all (case-insensitively or otherwise), this falls back to
 * plain positional order — first <tuv> is source, second is target —
 * rather than dropping the row. That matches how Subversia's own TMX
 * importer behaves (it doesn't check language codes at all; it just
 * takes tuv #1 / tuv #2 in document order), so a file that imports fine
 * into Subversia now also imports fine here.
 * @param {string} tmxContent
 */
function parseTMX(tmxContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(tmxContent, "application/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) throw new Error(translations[currentLanguage]['invalid_xml']);

    const header = xmlDoc.querySelector("header");
    if (!header) throw new Error(translations[currentLanguage]['no_header']);

    tmSourceLanguage = header.getAttribute("srclang") || '';
    const tuElements = xmlDoc.querySelectorAll("tu");
    if (tuElements.length === 0) {
        showMessage(translations[currentLanguage]['no_tus']);
        translationMemory = [];
        return;
    }

    const srcLangLower = tmSourceLanguage.toLowerCase();

    const firstTuvs = tuElements[0].querySelectorAll("tuv");
    const firstNonSrcTuv = Array.from(firstTuvs)
        .find(tuv => (tuv.getAttribute("xml:lang") || '').toLowerCase() !== srcLangLower);
    tmTargetLanguage = firstNonSrcTuv?.getAttribute("xml:lang") || 'unknown';
    const tgtLangLower = tmTargetLanguage.toLowerCase();

    const newTM = [];
    tuElements.forEach(tu => {
        const tuvs = Array.from(tu.querySelectorAll("tuv"));

        let srcTuv = tuvs.find(t => (t.getAttribute("xml:lang") || '').toLowerCase() === srcLangLower);
        let tgtTuv = tuvs.find(t => (t.getAttribute("xml:lang") || '').toLowerCase() === tgtLangLower);

        // Fallback: this TU's language codes didn't match the header at
        // all (case-insensitively either) — use plain document order
        // instead of dropping the row.
        if ((!srcTuv || !tgtTuv) && tuvs.length >= 2) {
            srcTuv = srcTuv || tuvs[0];
            tgtTuv = tgtTuv || tuvs[1];
        }

        const srcText = srcTuv?.querySelector("seg")?.textContent || '';
        const tgtText = tgtTuv?.querySelector("seg")?.textContent || '';
        if (srcTuv) newTM.push({ id: generateEntryId(), srcText, tgtText });
    });

    translationMemory = newTM;
    displaySrcLangSpan.textContent = tmSourceLanguage;
    displayTgtLangSpan.textContent = tmTargetLanguage;
}

/**
 * Serialises `translationMemory` into a TMX 1.4 document string.
 *
 * The <header> now includes every attribute the real TMX 1.4 DTD marks
 * #REQUIRED (creationtool, creationtoolversion, segtype, o-tmf,
 * adminlang, srclang, datatype) — the old header was missing
 * creationtoolversion, segtype and o-tmf. Verified with `xmllint --valid`
 * against the official tmx14.dtd: the old header failed validation
 * ("Element header does not carry attribute o-tmf/segtype/
 * creationtoolversion"), the new one passes cleanly. This matters for
 * strict TMX consumers even though it never affected Subversia's own
 * importer, which doesn't read the header at all beyond srclang.
 *
 * Each <tu> also now carries a `tuid` (the entry's internal id) — TMX
 * treats tuid as optional, but it's a small, free improvement for
 * round-tripping and matches Subversia's own TMX export convention.
 * @returns {string|null}
 */
function generateTMX() {
    if (!tmSourceLanguage || !tmTargetLanguage) {
        showMessage(translations[currentLanguage]['lang_not_configured']);
        return null;
    }

    const now = new Date();
    const creationdate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    let tmxString = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    tmxString += `<tmx version="1.4">\n`;
    tmxString += `  <header creationtool="Pandoria" creationtoolversion="${PANDORIA_VERSION}" segtype="sentence" o-tmf="Pandoria TMX" adminlang="en" srclang="${escapeXML(tmSourceLanguage)}" datatype="plaintext" creationdate="${creationdate}"/>\n`;
    tmxString += `  <body>\n`;

    translationMemory.forEach(entry => {
        const src = escapeXML(entry.srcText.trim());
        const tgt = escapeXML(entry.tgtText.trim());
        if (!src && !tgt) return;

        tmxString += `    <tu tuid="${escapeXML(entry.id)}">\n`;
        tmxString += `      <tuv xml:lang="${escapeXML(tmSourceLanguage)}">\n        <seg>${src}</seg>\n      </tuv>\n`;
        tmxString += `      <tuv xml:lang="${escapeXML(tmTargetLanguage)}">\n        <seg>${tgt}</seg>\n      </tuv>\n`;
        tmxString += `    </tu>\n`;
    });

    tmxString += `  </body>\n</tmx>\n`;
    return tmxString;
}

function downloadTMX() {
    const tmxContent = generateTMX();
    if (!tmxContent) return;

    const blob = new Blob([tmxContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'memoria_pandoria.tmx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage(translations[currentLanguage]['tm_saved_success']);
    clearBackup();
}

// ===============================================
// === "Import code" dialog (paste raw TMX/XML) ===
// ===============================================

function openImportCodeModal() {
    // Limpiar
    codeImportArea.value = '';
    codeValidationStatus.textContent = '';
    codeValidationStatus.className = 'validation-status';
    processImportCodeBtn.disabled = true;

    // Advertir si hay datos sin guardar
    if (translationMemory.length > 0) {
        showConfirmDialog(
            translations[currentLanguage]['confirm_new_tmx_title'],
            translations[currentLanguage]['confirm_new_tmx_text'],
            () => {
                importCodeModal.style.display = 'flex';
                codeImportArea.focus();
            }
        );
    } else {
        importCodeModal.style.display = 'flex';
        codeImportArea.focus();
    }
}

function validateCodeInput() {
    const code = codeImportArea.value.trim();
    if (!code) {
        codeValidationStatus.textContent = '';
        codeValidationStatus.className = 'validation-status';
        processImportCodeBtn.disabled = true;
        return;
    }

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(code, "application/xml");
        const parserError = xmlDoc.querySelector("parsererror");

        if (parserError) {
            throw new Error("Invalid XML");
        }
        const header = xmlDoc.querySelector("header");
        const body = xmlDoc.querySelector("body");

        if (!header || !body) {
            throw new Error("Missing TMX structure");
        }

        // Si llegamos aquí, es válido
        codeValidationStatus.textContent = translations[currentLanguage]['code_valid'];
        codeValidationStatus.className = 'validation-status status-valid';
        processImportCodeBtn.disabled = false;

    } catch (error) {
        codeValidationStatus.textContent = translations[currentLanguage]['code_invalid'];
        codeValidationStatus.className = 'validation-status status-invalid';
        processImportCodeBtn.disabled = true;
    }
}

function processPastedCode() {
    const code = codeImportArea.value;
    try {
        parseTMX(code);

        // Si el parseo es exitoso:
        historyStack = [];
        updateUndoButton();
        languageConfigSection.style.display = 'none';
        alignmentSection.classList.add('hidden');
        editorSection.classList.remove('hidden');
        renderTM(translationMemory, false);
        saveBackup();

        // Cerrar modal
        importCodeModal.style.display = 'none';

    } catch (error) {
        showMessage(`${translations[currentLanguage]['error_processing_tmx']}${error.message}`);
    }
}
