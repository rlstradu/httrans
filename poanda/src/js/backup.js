import { parseHtmlProject } from './core/html-doc.js';
import { db, ID_SESION } from './db.js';
import { hideLoadingOverlay, showLoadingOverlay, showMessage } from './dialogs.js';
import {
    backupIndicator,
    deleteLocalBackupBtn,
    lastBackupTime,
    loadLocalBackupBtn,
    restoreBackupModal,
    saveBackupToDiskBtn,
} from './dom.js';
import { renderTranslations } from './editor.js';
import { updateSaveButtonsState } from './files.js';
import { showGlossaryEditorSection, showLanguageConfigSection } from './glossary.js';
import { state } from './state.js';
import { showTMEditorSection, showTMLanguageConfigSection } from './tm.js';
import { translations } from './translations.js';

/**
 * Guarda la sesión completa en el navegador.
 *
 * Se llama sola cada diez segundos y también al guardar una copia en disco.
 * Si no hay nada cargado no hace nada: no tiene sentido machacar una copia
 * buena con una sesión vacía.
 *
 * @returns {Promise<void>}
 */
async function saveBackup() {
    if (!state.poEntries || state.poEntries.length === 0) return;

    const sessionData = {
        id: ID_SESION,
        poEntries: state.poEntries,
        currentFileType: state.currentFileType || 'po',
        currentFileName: state.currentFileName,
        // El HTML original hace falta para reconstruir el documento al restaurar.
        currentRawHtml: state.currentRawHtml || '',
        glossary: state.glossary || [],
        glossarySourceLanguage: state.glossarySourceLanguage || '',
        glossaryTargetLanguage: state.glossaryTargetLanguage || '',
        translationMemory: state.translationMemory || [],
        tmSourceLanguage: state.tmSourceLanguage || '',
        tmTargetLanguage: state.tmTargetLanguage || '',
        timestamp: new Date(),
    };

    try {
        await db.session.put(sessionData);
        await updateBackupStatusUI();
        console.log('✅ Copia de seguridad guardada a las ' + new Date().toLocaleTimeString());
    } catch (error) {
        console.error('❌ No se ha podido guardar la copia de seguridad:', error);
    }
}

/**
 * Recupera la sesión guardada, si la hay.
 *
 * @returns {Promise<Object|undefined>} La sesión, o undefined si no hay ninguna.
 */
async function loadBackup() {
    try {
        return await db.session.get(ID_SESION);
    } catch (error) {
        console.error('No se ha podido leer la copia de seguridad:', error);
        return undefined;
    }
}

/**
 * Borra la sesión guardada en el navegador.
 *
 * @returns {Promise<void>}
 */
async function clearBackup() {
    try {
        await db.session.clear();
    } catch (error) {
        console.error('No se ha podido borrar la copia de seguridad:', error);
    }
    await updateBackupStatusUI();
}

/**
 * Al abrir Poanda, mira si quedó una sesión sin terminar y ofrece recuperarla.
 *
 * @returns {Promise<void>}
 */
async function checkForBackup() {
    try {
        const backup = await loadBackup();
        if (backup && backup.poEntries && backup.poEntries.length > 0) {
            restoreBackupModal.classList.remove('hidden');
        }
        await updateBackupStatusUI();
    } catch (error) {
        console.error('No se ha podido comprobar si hay copia de seguridad:', error);
    }
}

async function restoreSession(backupData = null) {
    showLoadingOverlay(translations[state.currentLanguage]['loading_project']);
    try {
        const backup = backupData || (await loadBackup());
        if (backup) {
            // 1. Restaurar variables básicas
            state.currentFileType = backup.currentFileType || 'po';
            state.currentFileName = backup.currentFileName || 'translations.po';
            state.currentRawHtml = backup.currentRawHtml || ''; // Recuperar el HTML crudo

            // 2. LÓGICA ESPECIAL PARA HTML
            if (state.currentFileType === 'html' && state.currentRawHtml) {
                // Volvemos a parsear el HTML original para reconstruir htmlNodeMap y currentHtmlDoc
                // Esto llena htmlNodeMap pero crea poEntries vacíos
                parseHtmlProject(state.currentRawHtml);
            }

            // 3. Sobrescribir con las traducciones guardadas
            // Al hacer esto, mantenemos el mapa creado en el paso 2, pero inyectamos los textos del backup
            state.poEntries = backup.poEntries || [];

            state.glossary = backup.glossary || [];
            state.glossarySourceLanguage = backup.glossarySourceLanguage || '';
            state.glossaryTargetLanguage = backup.glossaryTargetLanguage || '';
            state.translationMemory = backup.translationMemory || [];
            state.tmSourceLanguage = backup.tmSourceLanguage || '';
            state.tmTargetLanguage = backup.tmTargetLanguage || '';

            renderTranslations(state.poEntries);

            if (state.glossarySourceLanguage && state.glossaryTargetLanguage) {
                showGlossaryEditorSection();
            } else {
                showLanguageConfigSection();
            }

            if (state.tmSourceLanguage && state.tmTargetLanguage) {
                showTMEditorSection();
            } else {
                showTMLanguageConfigSection();
            }

            updateSaveButtonsState();
        }
    } catch (error) {
        showMessage('Failed to restore session.');
        console.error(error);
    } finally {
        restoreBackupModal.classList.add('hidden');
        hideLoadingOverlay();
    }
}

async function updateBackupStatusUI() {
    try {
        const backup = await loadBackup();
        if (backup) {
            backupIndicator.style.display = 'inline-block';
            lastBackupTime.textContent = new Date(backup.timestamp).toLocaleString();
            loadLocalBackupBtn.disabled = false;
            saveBackupToDiskBtn.disabled = false;
            deleteLocalBackupBtn.disabled = false;
        } else {
            backupIndicator.style.display = 'none';
            lastBackupTime.textContent = translations[state.currentLanguage]['no_backup_available'];
            loadLocalBackupBtn.disabled = true;
            saveBackupToDiskBtn.disabled = true;
            deleteLocalBackupBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error updating backup UI:', error);
    }
}

export {
    checkForBackup,
    clearBackup,
    loadBackup,
    restoreSession,
    saveBackup,
    updateBackupStatusUI,
};
