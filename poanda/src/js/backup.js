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
import { showGlossaryEditorSection } from './glossary.js';
import { normalizarIdioma } from './core/idiomas.js';
import { pintarParDeIdiomas } from './idiomas-proyecto.js';
import { state } from './state.js';
import { showTMEditorSection } from './tm.js';
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
        // Y, en general, el contenido con el que se abriera el archivo, sea del
        // formato que sea: es lo que necesita el escritor para devolver intacto
        // lo que no se ha traducido. Los archivos comprimidos (Word, Excel) no
        // caben aquí y se quedan fuera a propósito; su copia de seguridad es el
        // proyecto, no esta sesión.
        contenidoOriginal:
            typeof state.contenidoOriginal === 'string' ? state.contenidoOriginal : '',
        glossary: state.glossary || [],
        translationMemory: state.translationMemory || [],
        // El par de idiomas del proyecto. Antes había dos, uno del glosario y
        // otro de la memoria, y se guardaban por separado.
        sourceLang: state.sourceLang || '',
        targetLang: state.targetLang || '',
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

            // 2. El contenido con el que se abrió el archivo, que es lo que
            // necesitan los escritores para devolver intacto lo que no se ha
            // traducido. Antes aquí se volvía a analizar el HTML para rehacer
            // un mapa de nodos que vivía en memoria; ya no hace falta, porque
            // cada segmento sabe en qué posición del archivo estaba.
            state.contenidoOriginal = backup.contenidoOriginal || state.currentRawHtml || '';

            // 3. Las traducciones guardadas.
            state.poEntries = backup.poEntries || [];

            state.glossary = backup.glossary || [];
            state.translationMemory = backup.translationMemory || [];

            // El par del proyecto. Las copias hechas antes de que existiera
            // traen los dos pares de entonces; se toma el del glosario, que era
            // el que se guardaba en el proyecto.
            state.sourceLang = normalizarIdioma(
                backup.sourceLang || backup.glossarySourceLanguage || backup.tmSourceLanguage || '',
            );
            state.targetLang = normalizarIdioma(
                backup.targetLang || backup.glossaryTargetLanguage || backup.tmTargetLanguage || '',
            );
            pintarParDeIdiomas();

            renderTranslations(state.poEntries);
            showGlossaryEditorSection();
            showTMEditorSection();

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
