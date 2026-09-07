import { saveBackup } from './backup.js';
import { parseHtmlProject, reconstructHtml } from './core/html-doc.js';
import { parseJsonProject, reconstructJson } from './core/json.js';
import { parsePoContent } from './core/po.js';
import { hideLoadingOverlay, showLoadingOverlay, showMessage, showPrompt } from './dialogs.js';
import {
    convertToMoButton,
    poSearchContainer,
    poSearchInput,
    savePoButton,
    statsContainer,
    translationsContainer,
} from './dom.js';
import { filterPOEntries, renderTranslations } from './editor.js';
import { state } from './state.js';
import { updateStatsDisplay, updateUtilityButtonStates } from './stats.js';
import { translations } from './translations.js';

async function loadHtmlFile() {
    showLoadingOverlay(translations[state.currentLanguage]['loading_file']);
    try {
        const fileData = await selectFile('htmlSourceFile', 'Select HTML file');

        // --- CAMBIO IMPORTANTE ---
        state.currentRawHtml = fileData.content;
        console.log('HTML cargado en memoria, longitud:', state.currentRawHtml.length); // <--- DEBUG
        // -------------------------

        state.poEntries = parseHtmlProject(fileData.content);
        state.currentFileType = 'html';
        state.currentFileName = fileData.name;

        renderTranslations(state.poEntries);
        updateStatsDisplay();
        updateSaveButtonsState();
        showMessage('HTML file loaded successfully.');

        // Forzar un backup inicial manual para probar
        setTimeout(saveBackup, 1000);
    } catch (e) {
        console.error(e);
        showMessage('Error loading HTML: ' + e.message);
    } finally {
        hideLoadingOverlay();
        document.getElementById('htmlSourceFile').value = '';
    }
}

async function saveHtmlFile() {
    if (state.poEntries.length === 0) return;
    const targetFileName = await showPrompt(
        translations[state.currentLanguage]['html_save_filename_prompt'],
        state.currentFileName,
    );
    if (!targetFileName) return;

    showLoadingOverlay(translations[state.currentLanguage]['saving_file']);
    try {
        const htmlContent = reconstructHtml(state.poEntries);
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = targetFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage('HTML saved successfully.');
    } catch (error) {
        showMessage('Error saving HTML: ' + error.message);
    } finally {
        hideLoadingOverlay();
    }
}

async function saveJsonFile() {
    // Allow saving if ANY entries exist, regardless of original file type
    if (state.poEntries.length === 0) {
        showMessage(translations[state.currentLanguage]['no_translations_to_save']);
        return;
    }

    // Always prompt for filename in this simplified flow
    let targetFileName = await showPrompt(
        translations[state.currentLanguage]['json_save_filename_prompt'],
        `translations_${state.currentLanguage}.json`,
    );
    if (!targetFileName) {
        showMessage(translations[state.currentLanguage]['select_file_error']); // User cancelled prompt
        return;
    }
    // Ensure it ends with .json
    if (!targetFileName.toLowerCase().endsWith('.json')) {
        targetFileName += '.json';
    }

    showLoadingOverlay(translations[state.currentLanguage]['saving_file']);
    try {
        const updatedJsonContent = reconstructJson(state.poEntries);
        const blob = new Blob([updatedJsonContent], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = targetFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage(translations[state.currentLanguage]['json_saved_success']);
    } catch (error) {
        showMessage(`${translations[state.currentLanguage]['error_saving_json']} ${error.message}`);
        console.error('Error saving JSON file:', error);
    } finally {
        hideLoadingOverlay();
    }
}

function updateSaveButtonsState() {
    const hasEntries = state.poEntries.length > 0;
    const isJson = state.currentFileType === 'json';
    const isHtml = state.currentFileType === 'html';

    // Solo se puede guardar PO/MO si NO es json Y NO es html
    const canSavePo = hasEntries && !isJson && !isHtml;

    // Menu items handling
    const savePoMenuItem = document.getElementById('saveFilePoBtn');
    const saveJsonMenuItem = document.getElementById('saveFileJsonBtn');
    const saveHtmlMenuItem = document.getElementById('saveFileHtmlBtn'); // NEW
    const convertMoMenuItem = document.getElementById('convertFileMoBtn');

    // Reset states
    savePoButton.disabled = !canSavePo;
    convertToMoButton.disabled = !canSavePo;

    if (savePoMenuItem) savePoMenuItem.classList.toggle('disabled-link', !canSavePo);
    if (convertMoMenuItem) convertMoMenuItem.classList.toggle('disabled-link', !canSavePo);

    if (saveJsonMenuItem)
        saveJsonMenuItem.classList.toggle('disabled-link', !(hasEntries && isJson));
    if (saveHtmlMenuItem)
        saveHtmlMenuItem.classList.toggle('disabled-link', !(hasEntries && isHtml));
}

async function loadSingleJsonFile() {
    showLoadingOverlay(translations[state.currentLanguage]['loading_file']);
    try {
        // Use the 'jsonSourceFile' input, but treat it as the main file
        const fileData = await selectFile(
            'jsonSourceFile',
            translations[state.currentLanguage]['load_json_menu'],
        );

        state.poEntries = parseJsonProject(fileData.content);
        state.currentFileType = 'json'; // Mark as JSON type
        state.currentFileName = fileData.name; // Use the loaded filename
        // Reset other JSON names as they aren't relevant in this flow
        state.currentJsonSourceFileName = fileData.name;
        state.currentJsonTargetFileName = null;

        renderTranslations(state.poEntries);
        updateStatsDisplay();
        updateSaveButtonsState(); // Enable JSON saving
        showMessage(translations[state.currentLanguage]['json_loaded_success']);
    } catch (error) {
        showMessage(
            `${translations[state.currentLanguage]['error_loading_json']} ${error.message || error}`,
        );
        console.error('Error loading single JSON file:', error);
        // Consider resetting if load fails
        // resetProjectState();
    } finally {
        hideLoadingOverlay();
        // Ensure file input is reset
        document.getElementById('jsonSourceFile').value = '';
    }
}

function processPoContent(content) {
    showLoadingOverlay(translations[state.currentLanguage]['loading_file']);
    try {
        state.poEntries = parsePoContent(content);
        setTimeout(() => {
            renderTranslations(state.poEntries);
            updateStatsDisplay();
        }, 0);
        poSearchInput.value = ''; // Clear search on new file
        filterPOEntries(); // Apply empty filter to reset view
    } catch (error) {
        showMessage(
            `${translations[state.currentLanguage]['error_reading_file']} ${error.message}`,
        );
        console.error('Error parsing file:', error);
        translationsContainer.innerHTML = `
                    <div class="text-center text-red-500 p-4 border border-red-300 rounded-md">
                        ${translations[state.currentLanguage]['file_processing_error']}
                    </div>
                `;
        savePoButton.disabled = true;
        convertToMoButton.disabled = true;
        poSearchContainer.classList.add('hidden');
        statsContainer.classList.remove('show');
        updateUtilityButtonStates();
    } finally {
        hideLoadingOverlay();
    }
}

async function processFile(file) {
    state.currentFileName = file.name;
    const content = await file.text();
    processPoContent(content);
}

function selectFile(inputId, promptMessage = 'Please select a file:') {
    return new Promise((resolve, reject) => {
        const fileInput = document.getElementById(inputId);
        if (!fileInput) {
            return reject(`File input with ID "${inputId}" not found.`);
        }

        // Optional: Show a message if needed (could use your showMessage modal)
        // alert(promptMessage); // Simple alert for now

        const changeHandler = async (event) => {
            const file = event.target.files[0];
            if (file) {
                try {
                    const content = await file.text();
                    resolve({ content: content, name: file.name });
                } catch (error) {
                    reject(`Error reading file: ${error.message}`);
                }
            } else {
                reject(
                    translations[state.currentLanguage]['select_file_error'] ||
                        'File selection failed or cancelled.',
                );
            }
            // Clean up listener and reset input
            fileInput.removeEventListener('change', changeHandler);
            fileInput.value = ''; // Allows selecting the same file again
        };

        fileInput.addEventListener('change', changeHandler);
        fileInput.click();
    });
}

export {
    loadHtmlFile,
    loadSingleJsonFile,
    processFile,
    processPoContent,
    saveHtmlFile,
    saveJsonFile,
    updateSaveButtonsState,
};
