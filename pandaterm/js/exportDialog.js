// js/exportDialog.js
// The "Export" button's format-choice modal (TBX or CSV) and its confirm
// action. Thin glue between tbx.js and csv.js — it holds no format logic
// of its own.

/**
 * Opens the export modal (filename + format choice).
 */
function showExportDialog() {
  if (state.glossary.length === 0 || !state.glossarySourceLanguage || !state.glossaryTargetLanguage) {
    showMessageBox(translations[state.currentUILanguage]["Cannot download empty or unconfigured glossary."]);
    return;
  }

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.id = 'exportModal';

  modalOverlay.innerHTML = `
        <div class="modal-content">
          <button class="close-modal-btn" onclick="closeModal('exportModal')">&times;</button>
          <h3 data-i18n="export_dialog_title">${translations[state.currentUILanguage]['export_dialog_title']}</h3>

          <div class="input-group">
            <label for="exportFilename" data-i18n="export_filename">${translations[state.currentUILanguage]['export_filename']}</label>
            <input id="exportFilename" type="text" value="${translations[state.currentUILanguage]['download_dialog_placeholder']}" />
          </div>

          <div class="input-group">
            <label data-i18n="export_format">${translations[state.currentUILanguage]['export_format']}</label>
            <div class="search-options" style="margin-top: 5px; margin-bottom: 0; justify-content: flex-start; gap: 25px;">
              <label>
                <input type="radio" name="exportFormat" value="tbx" checked>
                <span>TBX</span>
              </label>
              <label>
                <input type="radio" name="exportFormat" value="csv">
                <span>CSV</span>
              </label>
            </div>
          </div>

          <div class="dialog-buttons">
            <button class="btn-secondary" onclick="closeModal('exportModal')" data-i18n="cancel_button">${translations[state.currentUILanguage]['cancel_button']}</button>
            <button class="btn-primary" onclick="performExport()" data-i18n="export_action_button">${translations[state.currentUILanguage]['export_action_button']}</button>
          </div>
        </div>
      `;
  document.body.appendChild(modalOverlay);

  const filenameInput = document.getElementById('exportFilename');
  filenameInput.focus();
  filenameInput.select();
}

/**
 * Reads the export modal's filename/format choice and triggers the
 * matching download.
 */
function performExport() {
  const filename = document.getElementById('exportFilename').value.trim() || translations[state.currentUILanguage]['download_dialog_placeholder'];
  const format = document.querySelector('input[name="exportFormat"]:checked').value;

  if (format === 'tbx') {
    generateAndDownloadTBX(filename);
  } else if (format === 'csv') {
    generateAndDownloadCSV(filename);
  }

  closeModal('exportModal');
}
