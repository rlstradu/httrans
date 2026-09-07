import { insertAiResponse } from './ai.js';
import { showMessage } from './dialogs.js';
import { shortcutsEditor } from './dom.js';
import {
    getCurrentFocusedIndex,
    goToNextTranslation,
    goToPreviousTranslation,
    pushToUndoStack,
    setTranslationEditableState,
} from './editor.js';
import { state } from './state.js';
import { translations } from './translations.js';

const defaultShortcutConfig = {
    validateAndNext: { ctrlKey: true, altKey: false, shiftKey: false, key: 'Enter' },
    nextSegment: { ctrlKey: true, altKey: false, shiftKey: true, key: 'ArrowDown' },
    prevSegment: { ctrlKey: true, altKey: false, shiftKey: true, key: 'ArrowUp' },
    insertTMMatch1: { ctrlKey: true, altKey: true, shiftKey: false, key: '1' },
    insertTMMatch2: { ctrlKey: true, altKey: true, shiftKey: false, key: '2' },
    insertTMMatch3: { ctrlKey: true, altKey: true, shiftKey: false, key: '3' },
    insertTMMatch4: { ctrlKey: true, altKey: true, shiftKey: false, key: '4' },
    insertTMMatch5: { ctrlKey: true, altKey: true, shiftKey: false, key: '5' },
    insertGlossaryTerm1: { ctrlKey: true, altKey: false, shiftKey: false, key: '1' },
    insertGlossaryTerm2: { ctrlKey: true, altKey: false, shiftKey: false, key: '2' },
    insertGlossaryTerm3: { ctrlKey: true, altKey: false, shiftKey: false, key: '3' },
    insertGlossaryTerm4: { ctrlKey: true, altKey: false, shiftKey: false, key: '4' },
    insertGlossaryTerm5: { ctrlKey: true, altKey: false, shiftKey: false, key: '5' },
    toggleAI: { ctrlKey: true, altKey: false, shiftKey: true, key: 'A' },
    insertLastAI: { ctrlKey: false, altKey: true, shiftKey: true, key: 'I' },
    copyOriginal: { ctrlKey: true, altKey: false, shiftKey: true, key: 'C' },
};

function loadShortcuts() {
    const savedShortcuts = localStorage.getItem('poandaShortcutConfig');
    let finalConfig = { ...defaultShortcutConfig }; // Empezamos con los valores por defecto

    if (savedShortcuts) {
        const savedConfig = JSON.parse(savedShortcuts);
        // Recorremos los atajos guardados y solo aplicamos los que siguen siendo válidos
        for (const action in savedConfig) {
            // Si la acción del archivo guardado existe en nuestra configuración por defecto, la usamos.
            if (defaultShortcutConfig.hasOwnProperty(action)) {
                finalConfig[action] = savedConfig[action];
            }
        }
    }
    state.shortcutConfig = finalConfig;
}

function handleShortcutAction(action, pressedKey) {
    const currentFocused = getCurrentFocusedIndex();

    // La mayoría de las acciones requieren un segmento activo (excepto abrir proyecto o la IA)
    if (!currentFocused && !action.startsWith('open') && action !== 'toggleAI') return;

    // Manejo dinámico para acciones numeradas
    if (action.startsWith('insertTMMatch') || action.startsWith('insertGlossaryTerm')) {
        const isTM = action.startsWith('insertTMMatch');
        const items = isTM
            ? state.currentTMLatestSearchResults
            : state.currentGlossaryLatestResults;
        const index = parseInt(action.slice(-1)) - 1; // Extrae el número del final de la acción

        if (items.length > index) {
            const itemToInsert = items[index];
            const textToInsert = isTM ? itemToInsert.tgtText : itemToInsert.tgtTerm;
            const targetTextarea = document.getElementById(
                `msgstr-${currentFocused.entryIndex}-${currentFocused.segmentIndex}`,
            );

            if (targetTextarea && !targetTextarea.readOnly) {
                const start = targetTextarea.selectionStart;
                const end = targetTextarea.selectionEnd;
                targetTextarea.value =
                    targetTextarea.value.substring(0, start) +
                    textToInsert +
                    targetTextarea.value.substring(end);
                targetTextarea.selectionStart = targetTextarea.selectionEnd =
                    start + textToInsert.length;

                // Dispara el evento 'input' para actualizar contadores
                targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } else {
            showMessage(
                translations[state.currentLanguage][isTM ? 'tm_no_match_found' : 'no_match_found'],
            );
        }
        return; // Acción manejada
    }
    // Manejo para el resto de acciones
    switch (action) {
        case 'toggleAI':
            const aiButton = document.getElementById('aiBtn');
            if (aiButton) aiButton.click();
            break;

        case 'insertLastAI':
            if (state.lastAiResponseText) {
                insertAiResponse(state.lastAiResponseText);
            } else {
                showMessage(translations[state.currentLanguage]['no_ai_response_yet']);
            }
            break;

        case 'validateAndNext':
            // Es importante verificar que currentFocused existe antes de usarlo
            if (currentFocused) {
                setTranslationEditableState(
                    currentFocused.entryIndex,
                    currentFocused.segmentIndex,
                    false,
                );
                goToNextTranslation(currentFocused.entryIndex, currentFocused.segmentIndex);
            }
            break;

        case 'nextSegment':
            if (currentFocused) {
                goToNextTranslation(currentFocused.entryIndex, currentFocused.segmentIndex);
            }
            break;

        case 'prevSegment':
            if (currentFocused) {
                goToPreviousTranslation(currentFocused.entryIndex, currentFocused.segmentIndex);
            }
            break;

        case 'copyOriginal':
            if (currentFocused) {
                const originalText =
                    state.poEntries[currentFocused.entryIndex]?.sentenceSegments[
                        currentFocused.segmentIndex
                    ]?.original;
                const targetTextarea = document.getElementById(
                    `msgstr-${currentFocused.entryIndex}-${currentFocused.segmentIndex}`,
                );

                if (originalText !== undefined && targetTextarea && !targetTextarea.readOnly) {
                    pushToUndoStack();
                    targetTextarea.value = originalText;
                    // Disparamos el evento para que recalcule estadísticas, contadores y active los botones de guardado
                    targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            break;
    }
}

function formatShortcut(config) {
    let parts = [];
    if (config.ctrlKey) parts.push('Ctrl');
    if (config.altKey) parts.push('Alt');
    if (config.shiftKey) parts.push('Shift');

    let key = config.key;
    if (key === 'ArrowUp') key = '↑';
    if (key === 'ArrowDown') key = '↓';
    if (key === 'ArrowLeft') key = '←';
    if (key === 'ArrowRight') key = '→';

    parts.push(key);
    return parts.join(' + ');
}

function renderShortcutsUI() {
    shortcutsEditor.innerHTML = '';
    const lang = translations[state.currentLanguage];

    for (const action in state.tempShortcutConfig) {
        const config = state.tempShortcutConfig[action];

        let translationKey;
        if (action.startsWith('insertTMMatch')) {
            translationKey = `shortcut_tm_insert_${action.slice(-1)}`;
        } else if (action.startsWith('insertGlossaryTerm')) {
            translationKey = `shortcut_glossary_insert_${action.slice(-1)}`;
        } else {
            // --- INICIO DE LA CORRECCIÓN ---
            // Hacemos una correspondencia manual para los casos que no coinciden
            switch (action) {
                case 'validateAndNext':
                    translationKey = 'shortcut_validate';
                    break;
                case 'nextSegment':
                    translationKey = 'shortcut_next';
                    break;
                case 'prevSegment':
                    translationKey = 'shortcut_prev';
                    break;
                case 'copyOriginal':
                    translationKey = 'shortcut_copyOriginal';
                    break;
                default:
                    // Un respaldo para futuros atajos que sí coincidan
                    translationKey = `shortcut_${action}`;
                    break;
            }
            // --- FIN DE LA CORRECCIÓN ---
        }
        const actionLabel = lang[translationKey] || action;

        const row = document.createElement('div');
        row.className = 'grid grid-cols-2 items-center gap-4';

        const label = document.createElement('label');
        label.className = 'text-on-light-contrast font-medium';
        label.textContent = actionLabel;
        row.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.readOnly = true;
        input.className = 'shortcut-input';
        input.value = formatShortcut(config);
        input.dataset.action = action;
        input.placeholder = lang['click_to_set_shortcut'];

        input.addEventListener('keydown', (e) => {
            e.preventDefault();

            const tempConfig = {
                ctrlKey: e.ctrlKey,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
                key: '...',
            };
            input.value = formatShortcut(tempConfig);

            if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
                const newConfig = {
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey,
                    key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
                };

                state.tempShortcutConfig[action] = newConfig;
                input.value = formatShortcut(newConfig);
                input.blur();
            }
        });

        input.addEventListener('blur', () => {
            input.value = formatShortcut(state.tempShortcutConfig[action]);
        });

        row.appendChild(input);
        shortcutsEditor.appendChild(row);
    }
}

export { defaultShortcutConfig, handleShortcutAction, loadShortcuts, renderShortcutsUI };
