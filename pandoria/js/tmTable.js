// js/tmTable.js
// Core CRUD for the translation-memory table: render, add, edit, delete,
// undo history, and keyboard navigation between cells.
//
// Rows are identified by each entry's stable `id` (see utils.js), not by
// re-deriving an index from the row's text content. The original version
// matched a row back to `translationMemory` with
// `findIndex(e => e.srcText === ... && e.tgtText === ...)`, which silently
// picked the WRONG row whenever two entries had identical source+target
// text (a real risk in translation memories, which often contain
// duplicate or near-duplicate segments) — editing or deleting one could
// affect its duplicate instead.

// --- Gestión del Historial (Undo) ---
function saveStateToHistory() {
    historyStack.push(JSON.parse(JSON.stringify(translationMemory)));
    updateUndoButton();
}

function undoLastAction() {
    if (historyStack.length > 0) {
        translationMemory = historyStack.pop();
        renderTM(translationMemory, false);
        saveBackup();
    } else {
        showMessage(translations[currentLanguage]['no_more_undo']);
    }
    updateUndoButton();
}

function updateUndoButton() {
    undoBtn.disabled = historyStack.length === 0;
}

// --- Renderizado y Edición de la Tabla ---
function renderTM(tm, saveHistory = true) {
    if (saveHistory) saveStateToHistory();

    const filter = searchTermInput.value.toLowerCase();
    tmTableBody.innerHTML = '';

    const filteredTM = tm.filter(entry =>
        entry.srcText.toLowerCase().includes(filter) ||
        entry.tgtText.toLowerCase().includes(filter)
    );

    noResultsMessage.classList.toggle('hidden', !(filteredTM.length === 0 && tm.length > 0));

    filteredTM.forEach((entry) => {
        const row = document.createElement('tr');
        row.className = "border-b";
        row.innerHTML = `
            <td class="editable-cell" contenteditable="true" data-id="${entry.id}" data-field="srcText">${escapeHTML(entry.srcText)}</td>
            <td class="editable-cell" contenteditable="true" data-id="${entry.id}" data-field="tgtText">${escapeHTML(entry.tgtText)}</td>
            <td class="px-6 py-4 text-center">
                <button class="btn btn-danger font-medium py-1 px-3 rounded-md text-xs" data-id="${entry.id}">${translations[currentLanguage]['delete']}</button>
            </td>
        `;
        tmTableBody.appendChild(row);
    });

    tmTableBody.querySelectorAll('.editable-cell').forEach(cell => {
        cell.addEventListener('focus', saveStateToHistory);
        cell.addEventListener('input', updateEntry);
        cell.addEventListener('keydown', handleCellNavigation); // Listener para la navegación
    });
    tmTableBody.querySelectorAll('.btn-danger').forEach(button => {
        button.addEventListener('click', confirmDeleteEntry);
    });
}

// --- Funciones de Navegación por Teclado ---
function handleCellNavigation(event) {
    if (event.ctrlKey) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveFocus(event.target, 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveFocus(event.target, -1);
        }
    }
}

function moveFocus(element, direction) {
    const row = element.closest('tr');
    const rows = Array.from(tmTableBody.children);
    const currentIndex = rows.indexOf(row);
    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < rows.length) {
        const field = element.dataset.field; // 'srcText' o 'tgtText'
        const nextRow = rows[nextIndex];
        const target = nextRow.querySelector(`[data-field="${field}"]`);
        if (target) target.focus();
    }
}

function addEntry() {
    saveStateToHistory();
    translationMemory.unshift({ id: generateEntryId(), srcText: '', tgtText: '' });
    renderTM(translationMemory, false);
    saveBackup();
    const newCell = tmTableBody.querySelector('tr:first-child .editable-cell');
    if (newCell) newCell.focus();
}

function updateEntry(event) {
    const id = event.target.dataset.id;
    const field = event.target.dataset.field;
    const value = event.target.textContent;
    const entry = translationMemory.find(e => e.id === id);
    if (entry) {
        entry[field] = value;
        saveBackup();
    }
}

/**
 * Delete button click handler: asks for confirmation (via the shared
 * #confirmModal) before actually removing the row.
 * @param {MouseEvent} event
 */
function confirmDeleteEntry(event) {
    const id = event.target.dataset.id;
    showConfirmDialog(
        translations[currentLanguage]['delete_confirm_title'],
        translations[currentLanguage]['delete_confirm_text'],
        () => deleteEntryById(id)
    );
}

function deleteEntryById(id) {
    saveStateToHistory();
    const index = translationMemory.findIndex(e => e.id === id);
    if (index === -1) return;
    translationMemory.splice(index, 1);
    renderTM(translationMemory, false);
    saveBackup();
}
