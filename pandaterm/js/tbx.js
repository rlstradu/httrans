// js/tbx.js
// TBX (TermBase eXchange) import/export — the format Subversia and
// Locversia both read for glossary import, so this is the module that
// determines whether a file exported here actually opens there.
//
// Two compatibility fixes were made here, verified against Subversia's
// own parser (src/core/parsers/tbx.js):
//
// 1. Element casing: this file used to export `<LangSet>` (capital L).
//    The TBX standard, and Subversia's own importer, use lowercase
//    `langSet`. Since XML tag matching is case-sensitive, a TBX file
//    exported by the old PandaTerm silently imported as EMPTY in
//    Subversia (0 langSets found -> every entry skipped, no error
//    shown). Fixed by exporting `<langSet>` lowercase, matching both the
//    spec and Subversia. The importer here now accepts either casing on
//    read, so glossaries already exported by the old PandaTerm still
//    import correctly.
// 2. XML escaping: term/definition/notes text was interpolated into the
//    exported XML with no escaping at all. A term containing "&", "<",
//    ">", or a quote produced malformed XML that fails to parse in
//    Subversia, in PandaTerm's own re-import, and in any other TBX
//    reader. Fixed with a proper escapeXml() pass on every field.
//
// Locversia has no dedicated TBX parser file to check against directly
// (its glossary code lives in files that were not accessible to verify
// during this refactor), so this module targets the same standard,
// Subversia-verified TBX shape as the safest common baseline.

/**
 * Escapes text for safe interpolation into XML content or attribute
 * values. Order matters: "&" must be escaped first, or the "&" inserted
 * by the other replacements would itself get escaped a second time.
 * @param {*} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Serialises the current glossary into a TBX document string.
 * @returns {string}
 */
function generateTBX() {
  const now = new Date().toISOString();
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!DOCTYPE martif SYSTEM "TBXcoreStructV02.dtd">`,
    `<martif type="TBX" xml:lang="${escapeXml(state.glossarySourceLanguage)}">`,
    `  <martifHeader>`,
    `    <fileDesc>`,
    `      <sourceDesc>`,
    `        <p>Glossary exported from PandaTerm on ${now}</p>`,
    `      </sourceDesc>`,
    `    </fileDesc>`,
    `  </martifHeader>`,
    `  <text>`,
    `    <body>`
  ];

  state.glossary.forEach((entry, i) => {
    const id = 'c' + (i + 1);
    xml.push(`      <termEntry id="${id}">`);
    xml.push(`        <langSet xml:lang="${escapeXml(entry.srcLang || state.glossarySourceLanguage)}">`);
    xml.push(`          <tig>`);
    xml.push(`            <term>${escapeXml(entry.srcTerm)}</term>`);
    if (entry.srcPartOfSpeech) {
      xml.push(`            <termNote type="partOfSpeech">${escapeXml(entry.srcPartOfSpeech)}</termNote>`);
    }
    xml.push(`          </tig>`);
    xml.push(`        </langSet>`);
    xml.push(`        <langSet xml:lang="${escapeXml(entry.tgtLang || state.glossaryTargetLanguage)}">`);
    xml.push(`          <tig>`);
    xml.push(`            <term>${escapeXml(entry.tgtTerm)}</term>`);
    // Per TBXcoreStructV02.dtd, <tig> is (term, (termNote)*, %auxInfo;) —
    // every termNote must come before any auxInfo element (descrip is
    // part of auxInfo), so termNote (notes) has to be written before
    // descrip (definition) here or the file is invalid against its own
    // declared DTD, which is exactly the kind of thing a strict importer
    // (e.g. Trados/MultiTerm Convert) can reject outright.
    if (entry.notes) {
      xml.push(`            <termNote type="comment">${escapeXml(entry.notes)}</termNote>`);
    }
    if (entry.definition) {
      xml.push(`            <descrip type="definition">${escapeXml(entry.definition)}</descrip>`);
    }
    xml.push(`          </tig>`);
    xml.push(`        </langSet>`);
    xml.push(`      </termEntry>`);
  });

  xml.push(`    </body>`, `  </text>`, `</martif>`);
  return xml.join("\n");
}

/**
 * Builds the TBX text and triggers a browser download.
 * @param {string} filename
 */
function generateAndDownloadTBX(filename) {
  const blob = new Blob([generateTBX()], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith('.tbx') ? filename : `${filename}.tbx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Shared logic to parse XML content and import into the glossary. Accepts
 * both the older MARTIF-based TBX dialect (<martif>/<langSet>/<tig>) and
 * the newer TBX dialect (<tbx>/<langSec>/<termSec>).
 * @param {string} xmlString - The raw XML content
 */
function parseAndImportTBXString(xmlString) {
  try {
    console.log("Parsing TBX content...");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      const errorText = parserError.textContent || "Unknown XML parsing error.";
      throw new Error(`Parsing error: The content is not a valid XML/TBX. Details: ${errorText.substring(0, 100)}...`);
    }

    let entryTagName, langSetTagName, termGroupTagName, rootElement;

    if (xmlDoc.getElementsByTagName("martif").length > 0) {
      rootElement = "martif";
      entryTagName = "termEntry";
      // Standard TBX (and Subversia's own importer) use lowercase
      // "langSet". Glossaries exported by PandaTerm before this fix used
      // "LangSet" (capital L) — accept either so those older files still
      // import correctly, while newly exported ones use the standard form.
      langSetTagName = xmlDoc.getElementsByTagName("langSet").length > 0 ? "langSet" : "LangSet";
      termGroupTagName = "tig";
    } else if (xmlDoc.getElementsByTagName("tbx").length > 0) {
      rootElement = "tbx";
      entryTagName = "conceptEntry";
      langSetTagName = "langSec";
      termGroupTagName = "termSec";
    } else {
      throw new Error("Unsupported TBX root element. Expected <martif> or <tbx>.");
    }

    const entries = xmlDoc.getElementsByTagName(entryTagName);
    const newGlossary = [];
    const langCounts = {};

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const langSets = entry.getElementsByTagName(langSetTagName);
      let conceptDefinition = '';
      let conceptNotes = '';

      if (rootElement === "tbx") {
        const conceptDefinitionElement = entry.querySelector('descrip[type="definition"]');
        const conceptNotesElement = entry.querySelector('note');
        conceptDefinition = conceptDefinitionElement ? conceptDefinitionElement.textContent || '' : '';
        conceptNotes = conceptNotesElement ? conceptNotesElement.textContent || '' : '';
      }

      if (langSets.length >= 2) {
        let srcLang = '', srcTerm = '', srcPartOfSpeech = '';
        let tgtLang = '', tgtTerm = '', tgtPartOfSpeech = '';
        let entryDefinition = conceptDefinition;
        let entryNotes = conceptNotes;

        const firstLangSet = langSets[0];
        srcLang = firstLangSet.getAttribute("xml:lang") || '';
        const firstTermGroup = firstLangSet.getElementsByTagName(termGroupTagName)[0];
        if (firstTermGroup) {
          srcTerm = firstTermGroup.getElementsByTagName("term")[0]?.textContent || '';
          let minPartOfSpeechElement = firstTermGroup.getElementsByTagNameNS("http://www.tbxinfo.net/ns/min", "partOfSpeech")[0];
          if (minPartOfSpeechElement) {
            srcPartOfSpeech = minPartOfSpeechElement.textContent || '';
          } else {
            srcPartOfSpeech = firstTermGroup.querySelector('termNote[type="partOfSpeech"]')?.textContent || '';
          }
        }

        const secondLangSet = langSets[1];
        tgtLang = secondLangSet.getAttribute("xml:lang") || '';
        const secondTermGroup = secondLangSet.getElementsByTagName(termGroupTagName)[0];
        if (secondTermGroup) {
          tgtTerm = secondTermGroup.getElementsByTagName("term")[0]?.textContent || '';
          let minPartOfSpeechElement = secondTermGroup.getElementsByTagNameNS("http://www.tbxinfo.net/ns/min", "partOfSpeech")[0];
          if (minPartOfSpeechElement) {
            tgtPartOfSpeech = minPartOfSpeechElement.textContent || '';
          } else {
            tgtPartOfSpeech = secondTermGroup.querySelector('termNote[type="partOfSpeech"]')?.textContent || '';
          }

          const termGroupDefinitionElement = secondTermGroup.querySelector('descrip[type="definition"]');
          const termGroupNotesElement = secondTermGroup.querySelector('termNote[type="comment"]');
          const termGroupContextElement = secondTermGroup.querySelector('descrip[type="context"]');

          if (termGroupDefinitionElement) {
            entryDefinition = termGroupDefinitionElement.textContent || '';
          } else if (termGroupContextElement) {
            entryDefinition = termGroupContextElement.textContent || '';
          }

          if (termGroupNotesElement) {
            entryNotes = termGroupNotesElement.textContent || '';
          }
        }

        if (srcTerm || tgtTerm) {
          newGlossary.push({
            srcLang: srcLang, srcTerm: srcTerm, srcPartOfSpeech: srcPartOfSpeech,
            tgtLang: tgtLang, tgtTerm: tgtTerm, tgtPartOfSpeech: tgtPartOfSpeech,
            definition: entryDefinition, notes: entryNotes
          });
          langCounts[srcLang] = (langCounts[srcLang] || 0) + 1;
          langCounts[tgtLang] = (langCounts[tgtLang] || 0) + 1;
        }
      }
    }

    const sortedLangs = Object.keys(langCounts).sort((a, b) => langCounts[b] - langCounts[a]);
    let detectedSrcLang, detectedTgtLang;

    if (sortedLangs.length >= 2) {
      detectedSrcLang = sortedLangs[0];
      detectedTgtLang = sortedLangs[1];
      newGlossary.forEach(entry => {
        if (entry.srcLang !== detectedSrcLang && entry.tgtLang === detectedSrcLang) {
          [entry.srcLang, entry.tgtLang] = [entry.tgtLang, entry.srcLang];
          [entry.srcTerm, entry.tgtTerm] = [entry.tgtTerm, entry.srcTerm];
          [entry.srcPartOfSpeech, entry.tgtPartOfSpeech] = [entry.tgtPartOfSpeech, entry.srcPartOfSpeech];
        }
      });
    } else {
      const rootXmlLang = xmlDoc.documentElement.getAttribute("xml:lang");
      detectedSrcLang = rootXmlLang || 'en-US';
      detectedTgtLang = 'es-ES';
      if (newGlossary.length > 0) {
        showMessageBox(translations[state.currentUILanguage]["No valid language pairs found in TBX. Defaulting to en-US/es-ES."]);
      }
    }

    saveState();
    state.glossary = newGlossary;
    state.glossarySourceLanguage = detectedSrcLang;
    state.glossaryTargetLanguage = detectedTgtLang;

    document.getElementById('configSrcLang').value = state.glossarySourceLanguage;
    document.getElementById('configTgtLang').value = state.glossaryTargetLanguage;
    document.getElementById('displaySrcLang').value = state.glossarySourceLanguage;
    document.getElementById('displayTgtLang').value = state.glossaryTargetLanguage;

    showSection('editorSection');
    renderGlossary();
    saveBackupToLocalStorage();

    let successMsg = translations[state.currentUILanguage]['tbx_import_success'] || "Imported {count} new terms from TBX.";
    showToast(successMsg.replace('{count}', newGlossary.length));
    console.log("TBX import completed successfully.");

  } catch (error) {
    console.error("Error during TBX file processing:", error);
    showMessageBox(translations[state.currentUILanguage]["Error loading TBX file. Please ensure it's a valid XML/TBX."] + " " + error.message);
  }
}

/**
 * Reads a File object as TBX/XML text and imports it into the glossary.
 * @param {File} file
 */
function readTBXFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    parseAndImportTBXString(reader.result);
  };
  reader.readAsText(file);
}

// ===============================================
// === "Import code" dialog (paste raw TBX/XML) ===
// ===============================================

/**
 * Opens the "paste TBX/XML code" modal.
 */
function showImportCodeDialog() {
  if (!state.glossarySourceLanguage || !state.glossaryTargetLanguage) {
    showMessageBox(translations[state.currentUILanguage]['lang_config_required']);
    showSection('languageConfigSection');
    return;
  }

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.id = 'importCodeModal';

  modalOverlay.innerHTML = `
            <div class="modal-content large-modal">
                <button class="close-modal-btn" onclick="closeModal('importCodeModal')">&times;</button>
                <h3 data-i18n="import_code_title">${translations[state.currentUILanguage]['import_code_title']}</h3>
                <div class="input-group">
                    <label data-i18n="paste_code_here">${translations[state.currentUILanguage]['paste_code_here']}</label>
                    <textarea id="tbCodeInput" class="code-editor" spellcheck="false" placeholder="<martif..."></textarea>
                    <div id="codeValidationStatus" class="validation-status"></div>
                </div>
                <div class="dialog-buttons">
                    <button class="btn-secondary" onclick="closeModal('importCodeModal')" data-i18n="cancel_button">${translations[state.currentUILanguage]['cancel_button']}</button>
                    <button id="btnConfirmImportCode" class="btn-primary" onclick="importFromCode()" data-i18n="import_action_button" disabled>${translations[state.currentUILanguage]['import_action_button']}</button>
                </div>
            </div>
        `;
  document.body.appendChild(modalOverlay);

  const textarea = document.getElementById('tbCodeInput');
  textarea.focus();

  // Add real-time validation listener
  textarea.addEventListener('input', checkCodeValidity);
}

/**
 * Validates the pasted code as the user types, and toggles the import
 * button accordingly.
 */
function checkCodeValidity() {
  const code = document.getElementById('tbCodeInput').value.trim();
  const statusDiv = document.getElementById('codeValidationStatus');
  const confirmBtn = document.getElementById('btnConfirmImportCode');

  if (!code) {
    statusDiv.innerHTML = '';
    confirmBtn.disabled = true;
    return;
  }

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(code, "application/xml");
    const parserError = xmlDoc.querySelector("parsererror");

    if (parserError) {
      statusDiv.innerHTML = `<span class="status-invalid">${translations[state.currentUILanguage]['invalid_xml']}</span>`;
      confirmBtn.disabled = true;
    } else {
      // Check if it has TBX root elements
      if (xmlDoc.getElementsByTagName("martif").length > 0 || xmlDoc.getElementsByTagName("tbx").length > 0) {
        statusDiv.innerHTML = `<span class="status-valid">${translations[state.currentUILanguage]['valid_xml']}</span>`;
        confirmBtn.disabled = false;
      } else {
        statusDiv.innerHTML = `<span class="status-invalid">XML valid but no Martif/TBX root found</span>`;
        confirmBtn.disabled = true;
      }
    }
  } catch (e) {
    statusDiv.innerHTML = `<span class="status-invalid">${translations[state.currentUILanguage]['invalid_xml']}</span>`;
    confirmBtn.disabled = true;
  }
}

/**
 * Imports the code currently pasted into the "import code" modal.
 */
function importFromCode() {
  const code = document.getElementById('tbCodeInput').value;
  closeModal('importCodeModal');
  parseAndImportTBXString(code);
}
