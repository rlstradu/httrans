// js/glossaryTable.js
// The glossary's core CRUD + table rendering: add/edit/delete a term,
// render the (filtered) table, undo history, section/collapse toggling,
// and confirming the glossary's source/target languages. This is the
// module every other feature (TBX, CSV, i18n) calls back into to
// re-render after it changes the glossary.

/**
 * Updates the disabled state of the undo button based on history.
 */
function updateUndoButtonState() {
  const undoButton = document.getElementById('undoButton');
  if (undoButton) {
    undoButton.disabled = state.history.length === 0;
  }
}

/**
 * Saves the current state of the glossary to the history for undo functionality.
 */
function saveState() {
  // Save a deep copy of the current glossary state
  state.history.push(JSON.parse(JSON.stringify(state.glossary)));
  updateUndoButtonState();
}

/**
 * Undoes the last action by restoring the previous glossary state from history.
 */
function undo() {
  if (state.history.length > 0) {
    state.glossary = state.history.pop();
    renderGlossary();
    updateUndoButtonState();
    saveBackupToLocalStorage();
  }
}

/**
 * Shows a specific section of the application and hides others.
 * @param {string} sectionId - The ID of the section to show.
 */
function showSection(sectionId) {
  const sectionToShow = document.getElementById(sectionId);
  const sectionToHide = sectionId === 'editorSection' ? document.getElementById('languageConfigSection') : document.getElementById('editorSection');

  sectionToHide.classList.add('hidden-section');
  sectionToShow.classList.remove('hidden-section');
}

/**
 * Toggles the visibility of a collapsible section.
 * @param {string} contentId - The ID of the content element to collapse/expand.
 */
function toggleCollapse(contentId) {
  const content = document.getElementById(contentId);
  const header = content.previousElementSibling; // The h2
  if (content.classList.contains('open')) {
    content.classList.remove('open');
    header.classList.remove('open');
  } else {
    content.classList.add('open');
    header.classList.add('open');
  }
}

/**
 * Performs the actual reset of the glossary after confirmation.
 */
function performResetGlossary() {
  saveState();
  state.glossary = [];
  state.glossarySourceLanguage = '';
  state.glossaryTargetLanguage = '';
  document.getElementById('configSrcLang').value = 'en-US';
  document.getElementById('configTgtLang').value = 'es-ES';
  document.getElementById('srcTerm').value = '';
  document.getElementById('tgtTerm').value = '';
  document.getElementById('definition').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('partOfSpeech').value = '';
  document.getElementById('searchTerm').value = '';
  // Reset search scope to 'all'
  document.querySelector('input[name="searchScope"][value="all"]').checked = true;

  // Cerrar secciones colapsables
  document.getElementById('currentLangContent').classList.remove('open');
  document.getElementById('currentLangContent').previousElementSibling.classList.remove('open');
  document.getElementById('addTermContent').classList.remove('open');
  document.getElementById('addTermContent').previousElementSibling.classList.remove('open');

  showSection('languageConfigSection');
  renderGlossary();
  saveBackupToLocalStorage();
}

/**
 * Prompts the user for confirmation before resetting the glossary.
 */
function resetGlossary() {
  const title = translations[state.currentUILanguage]['new_glossary_confirm_title'];
  const message = translations[state.currentUILanguage]['new_glossary_confirm_text'];
  showConfirmationDialog(title, message, performResetGlossary, null, null, null, 'btn-danger');
}

/**
 * Confirms and sets the glossary's source and target languages.
 */
function confirmGlossaryLanguages() {
  const srcLang = document.getElementById('configSrcLang').value.trim();
  const tgtLang = document.getElementById('configTgtLang').value.trim();

  if (!srcLang || !tgtLang) {
    showMessageBox(translations[state.currentUILanguage]['lang_config_required']);
    return;
  }

  state.glossarySourceLanguage = srcLang;
  state.glossaryTargetLanguage = tgtLang;
  document.getElementById('displaySrcLang').value = state.glossarySourceLanguage;
  document.getElementById('displayTgtLang').value = state.glossaryTargetLanguage;
  showSection('editorSection');
  renderGlossary();

  // Abrir la sección de añadir término por defecto al confirmar
  toggleCollapse('addTermContent');

  // Clear history when starting a new glossary configuration
  state.history = [];
  updateUndoButtonState();
  saveBackupToLocalStorage();
}

/**
 * Adds a new term to the glossary.
 */
function addTerm() {
  const srcTermInput = document.getElementById("srcTerm");
  const tgtTermInput = document.getElementById("tgtTerm");
  const definitionInput = document.getElementById("definition");
  const notesInput = document.getElementById("notes");
  const partOfSpeechInput = document.getElementById("partOfSpeech");

  const srcTerm = srcTermInput.value.trim();
  const tgtTerm = tgtTermInput.value.trim();
  const definition = definitionInput.value.trim();
  const notes = notesInput.value.trim();
  const partOfSpeech = partOfSpeechInput.value.trim();

  if (!srcTerm || !tgtTerm) {
    showMessageBox(translations[state.currentUILanguage]['both_terms_required']);
    return;
  }

  saveState();

  state.glossary.push({
    srcLang: state.glossarySourceLanguage,
    srcTerm: srcTerm,
    tgtLang: state.glossaryTargetLanguage,
    tgtTerm: tgtTerm,
    definition: definition,
    notes: notes,
    srcPartOfSpeech: partOfSpeech
  });
  srcTermInput.value = "";
  tgtTermInput.value = "";
  definitionInput.value = "";
  notesInput.value = "";
  partOfSpeechInput.value = "";
  srcTermInput.focus();
  renderGlossary(true); // Pass true to animate the last row
  saveBackupToLocalStorage();
}

/**
 * Deletes a term from the glossary by its original index.
 * @param {number} originalIndex - The original index of the term in the glossary array.
 */
function deleteTerm(originalIndex) {
  const title = translations[state.currentUILanguage]['delete_term_confirm_title'];
  const message = translations[state.currentUILanguage]['delete_term_confirm_text'];

  const performDelete = () => {
    saveState();
    state.glossary.splice(originalIndex, 1);
    renderGlossary();
    closeModalIfPresent('editModal'); // Close modal if open after deleting
    saveBackupToLocalStorage();
  };

  showConfirmationDialog(title, message, performDelete, null, null, null, 'btn-danger');
}

// Local helper so this module doesn't need to import closeModal from
// dialogs.js just for this one internal use.
function closeModalIfPresent(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();
}

/**
 * Opens a modal to edit an existing term.
 * @param {number} index - The index of the term in the glossary array.
 */
function editTerm(index) {
  const term = state.glossary[index];
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.id = 'editModal';

  const posOptions = ['noun', 'verb', 'adj', 'adv'].map(pos =>
    `<option value="${pos}" ${term.srcPartOfSpeech === pos ? 'selected' : ''}>${pos}</option>`
  ).join('');

  modalOverlay.innerHTML = `
        <div class="modal-content">
            <button class="close-modal-btn" onclick="closeModal('editModal')">&times;</button>
            <h3 data-i18n="edit_term_title">${translations[state.currentUILanguage]['edit_term_title']}</h3>
            <div class="input-group">
                <label for="editSrcTerm" data-i18n="term">${translations[state.currentUILanguage]['term']}<span class="required-asterisk">*</span></label>
                <input id="editSrcTerm" type="text" value="${term.srcTerm}" />
            </div>
            <div class="input-group">
                <label for="editTgtTerm" data-i18n="translation">${translations[state.currentUILanguage]['translation']}<span class="required-asterisk">*</span></label>
                <input id="editTgtTerm" type="text" value="${term.tgtTerm}" />
            </div>
            <div class="input-group">
                <label for="editDefinition" data-i18n="definition">${translations[state.currentUILanguage]['definition']}</label>
                <textarea id="editDefinition">${term.definition || ''}</textarea>
            </div>
            <div class="input-group">
                <label for="editNotes" data-i18n="notes">${translations[state.currentUILanguage]['notes']}</label>
                <textarea id="editNotes">${term.notes || ''}</textarea>
            </div>
            <div class="input-group">
                <label for="editPartOfSpeech" data-i18n="part_of_speech">${translations[state.currentUILanguage]['part_of_speech']}</label>
                <select id="editPartOfSpeech">
                    <option value="" data-i18n="select_pos_placeholder">${translations[state.currentUILanguage]['select_pos_placeholder']}</option>
                    ${posOptions}
                </select>
            </div>
            <div class="dialog-buttons">
                <button class="btn-danger" onclick="deleteTerm(${index})" data-i18n="delete_button">${translations[state.currentUILanguage]['delete_button']}</button>
                <button class="btn-secondary" onclick="closeModal('editModal')" data-i18n="cancel_button">${translations[state.currentUILanguage]['cancel_button']}</button>
                <button class="btn-primary" onclick="saveEditedTerm(${index})" data-i18n="update_button">${translations[state.currentUILanguage]['update_button']}</button>
            </div>
        </div>
    `;
  document.body.appendChild(modalOverlay);
}

/**
 * Saves the changes made to a term in the edit modal.
 * @param {number} index - The index of the term in the glossary array.
 */
function saveEditedTerm(index) {
  const srcTerm = document.getElementById('editSrcTerm').value.trim();
  const tgtTerm = document.getElementById('editTgtTerm').value.trim();
  const definition = document.getElementById('editDefinition').value.trim();
  const notes = document.getElementById('editNotes').value.trim();
  const partOfSpeech = document.getElementById('editPartOfSpeech').value.trim();

  if (!srcTerm || !tgtTerm) {
    showMessageBox(translations[state.currentUILanguage]['both_terms_required']);
    return;
  }

  saveState(); // Save state before modification

  state.glossary[index].srcTerm = srcTerm;
  state.glossary[index].tgtTerm = tgtTerm;
  state.glossary[index].definition = definition;
  state.glossary[index].notes = notes;
  state.glossary[index].srcPartOfSpeech = partOfSpeech;

  closeModalIfPresent('editModal');
  renderGlossary();
  saveBackupToLocalStorage();
}

/**
 * Formats text to make URLs clickable.
 * @param {string} text - The input text.
 * @returns {string} The text with URLs replaced by clickable links.
 */
function formatTextWithLinks(text) {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

/**
 * Applies the current column visibility settings to the table.
 */
function applyColumnVisibility() {
  const table = document.querySelector('table');
  if (!table) return;

  const headers = Array.from(table.querySelectorAll('th'));
  const rows = Array.from(table.querySelectorAll('tbody tr'));

  headers.forEach((th, index) => {
    th.style.display = '';
    rows.forEach(row => {
      const cell = row.children[index];
      if (cell) {
        cell.style.display = '';
      }
    });
  });
}

/**
 * Renders the glossary table based on current search and filter criteria.
 * @param {boolean} [animateLastRow] - Whether to apply animation to the last added row.
 */
function renderGlossary(animateLastRow = false) {
  const tbody = document.getElementById("glossaryTable");
  const search = document.getElementById("searchTerm").value.toLowerCase();
  const searchScope = document.querySelector('input[name="searchScope"]:checked').value;
  tbody.innerHTML = "";

  const filteredGlossary = state.glossary.filter(entry => {
    const srcMatch = entry.srcTerm.toLowerCase().includes(search);
    const tgtMatch = entry.tgtTerm.toLowerCase().includes(search);
    const defMatch = (entry.definition || '').toLowerCase().includes(search);
    const notesMatch = (entry.notes || '').toLowerCase().includes(search);
    const posMatch = (entry.srcPartOfSpeech || '').toLowerCase().includes(search);

    if (searchScope === 'source') {
      return srcMatch;
    } else if (searchScope === 'target') {
      return tgtMatch;
    } else { // 'all'
      return srcMatch || tgtMatch || defMatch || notesMatch || posMatch;
    }
  });

  filteredGlossary.forEach((entry, i) => {
    const originalIndex = state.glossary.findIndex(g => g === entry);
    const row = document.createElement("tr");
    row.innerHTML = `
            <td class="editable" onclick="editTerm(${originalIndex})">${entry.srcTerm}</td>
            <td class="editable" onclick="editTerm(${originalIndex})">${entry.tgtTerm}</td>
            <td class="editable" onclick="editTerm(${originalIndex})">${formatTextWithLinks(entry.definition)}</td>
            <td class="editable" onclick="editTerm(${originalIndex})">${formatTextWithLinks(entry.notes)}</td>
            <td class="editable" onclick="editTerm(${originalIndex})">${entry.srcPartOfSpeech || ''}</td>
            <td><button class="delete-btn" onclick="deleteTerm(${originalIndex})">${translations[state.currentUILanguage]['delete_button']}</button></td>
          `;

    if (animateLastRow && i === filteredGlossary.length - 1) {
      row.classList.add('row-pop-in');
    }

    tbody.appendChild(row);
  });
  applyColumnVisibility(); // Apply visibility after rendering
}
