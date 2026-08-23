// js/csv.js
// CSV import/export for the glossary. Semicolon-delimited (auto-detected
// on import), UTF-8 with a BOM so Excel opens accented characters
// correctly on export.
//
// Note: this is PandaTerm's own CSV dialect (7 columns: Source Language,
// Source Term, Target Language, Target Term, Definition, Notes, Part of
// Speech; ";" delimiter). It does not match Subversia's glossary CSV
// importer, which expects a simpler 2-5 column, comma-delimited layout
// with the source term in column 1. See README.md's "Compatibility
// notes" for details; fixing that mismatch was out of scope for the TBX
// compatibility work this module was split out for.

function escapeCSV(field) {
  if (field === null || field === undefined) {
    return '""';
  }
  const str = String(field);
  const escaped = str.replace(/"/g, '""');
  if (str.includes('"') || str.includes(';') || str.includes('\n') || str.includes('\r')) {
    return `"${escaped}"`;
  }
  return escaped;
}

/**
 * Builds the CSV text and triggers a browser download.
 * @param {string} filename
 */
function generateAndDownloadCSV(filename) {
  const headers = [
    "Source Language", "Source Term", "Target Language", "Target Term",
    "Definition", "Notes", "Part of Speech"
  ];
  let csvContent = headers.join(";") + "\n";

  state.glossary.forEach(entry => {
    const row = [
      entry.srcLang || state.glossarySourceLanguage,
      entry.srcTerm,
      entry.tgtLang || state.glossaryTargetLanguage,
      entry.tgtTerm,
      entry.definition || '',
      entry.notes || '',
      entry.srcPartOfSpeech || ''
    ];
    csvContent += row.map(escapeCSV).join(";") + "\n";
  });

  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSVRow(row, delimiter) {
  const fields = [];
  let inQuote = false;
  let field = '';

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      if (inQuote && row[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (char === delimiter && !inQuote) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }

  fields.push(field);

  return fields.map(f => {
    if (f.startsWith('"') && f.endsWith('"')) {
      return f.substring(1, f.length - 1).replace(/""/g, '"');
    }
    return f;
  });
}

function parseCSV(textContent) {
  const newGlossary = [];
  const lines = textContent.split(/\r?\n/);

  if (lines.length < 2 || !lines[0].trim()) {
    throw new Error(translations[state.currentUILanguage]['csv_empty_error']);
  }

  const delimiter = lines[0].includes(';') ? ';' : ',';

  const headers = parseCSVRow(lines[0], delimiter);

  const map = {
    srcTerm: headers.indexOf("Source Term"),
    tgtTerm: headers.indexOf("Target Term"),
    definition: headers.indexOf("Definition"),
    notes: headers.indexOf("Notes"),
    partOfSpeech: headers.indexOf("Part of Speech")
  };

  if (map.srcTerm === -1 || map.tgtTerm === -1) {
    map.srcTerm = headers.indexOf(state.glossarySourceLanguage);
    map.tgtTerm = headers.indexOf(state.glossaryTargetLanguage);

    if (map.srcTerm === -1 || map.tgtTerm === -1) {
      let errorMsg = translations[state.currentUILanguage]['csv_header_error'];
      errorMsg = errorMsg.replace('{srcLang}', state.glossarySourceLanguage).replace('{tgtLang}', state.glossaryTargetLanguage);
      throw new Error(errorMsg);
    }
  }

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = parseCSVRow(lines[i], delimiter);

    const srcTerm = values[map.srcTerm] || '';
    const tgtTerm = values[map.tgtTerm] || '';

    if (srcTerm && tgtTerm) {
      newGlossary.push({
        srcLang: state.glossarySourceLanguage,
        srcTerm: srcTerm,
        tgtLang: state.glossaryTargetLanguage,
        tgtTerm: tgtTerm,
        definition: (map.definition > -1 ? values[map.definition] : '') || '',
        notes: (map.notes > -1 ? values[map.notes] : '') || '',
        srcPartOfSpeech: (map.partOfSpeech > -1 ? values[map.partOfSpeech] : '') || ''
      });
    }
  }

  if (newGlossary.length > 0) {
    saveState();
    state.glossary = state.glossary.concat(newGlossary);
    renderGlossary();
    saveBackupToLocalStorage();
    let successMsg = translations[state.currentUILanguage]['csv_import_success'];
    showToast(successMsg.replace('{count}', newGlossary.length));
  } else {
    showToast(translations[state.currentUILanguage]['csv_import_no_terms']);
  }
}

/**
 * Reads a File object as CSV text and imports it into the glossary.
 * @param {File} file
 */
function readCSVFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      console.log("Cargando CSV...");
      parseCSV(reader.result);
    } catch (error) {
      console.error("Error durante el procesamiento del archivo CSV:", error);
      showMessageBox(error.message);
    }
  };
  reader.readAsText(file, "UTF-8");
}
