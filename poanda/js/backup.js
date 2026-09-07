import { parseHtmlProject } from './core/html-doc.js';
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

const DB_NAME = 'PoandaBackup';

const DB_VERSION = 1;

const STORE_NAME = 'session';

let db;

function openDb() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('Error opening IndexedDB.');
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

async function saveBackup() {
    // 1. Comprobación de seguridad: Si no hay base de datos o entradas, salimos.
    if (!db || typeof state.poEntries === 'undefined' || state.poEntries.length === 0) return;

    // 2. Preparar el HTML Crudo de forma segura
    // Nos aseguramos de que currentRawHtml exista, si no, guardamos cadena vacía.
    let htmlToSave = '';
    if (typeof state.currentRawHtml !== 'undefined' && state.currentRawHtml) {
        htmlToSave = state.currentRawHtml;
    }

    const sessionData = {
        id: 'currentSession',
        poEntries: state.poEntries, // Tus traducciones
        currentFileType:
            typeof state.currentFileType !== 'undefined' ? state.currentFileType : 'po',
        currentFileName: state.currentFileName,
        currentRawHtml: htmlToSave, // <--- AQUÍ GUARDAMOS EL HTML ORIGINAL
        glossary: state.glossary || [],
        glossarySourceLanguage: state.glossarySourceLanguage || '',
        glossaryTargetLanguage: state.glossaryTargetLanguage || '',
        translationMemory: state.translationMemory || [],
        tmSourceLanguage: state.tmSourceLanguage || '',
        tmTargetLanguage: state.tmTargetLanguage || '',
        timestamp: new Date(),
    };

    // 3. Intentar guardar en la Base de Datos
    try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(sessionData);

        request.onsuccess = () => {
            updateBackupStatusUI();
            // Si abres la consola (F12), verás este mensaje cada 10s si funciona:
            console.log(
                '✅ Backup guardado correctamente a las ' + new Date().toLocaleTimeString(),
            );
        };

        request.onerror = (e) => {
            console.error('❌ Error al escribir en IndexedDB:', e.target.error);
        };
    } catch (err) {
        console.error('❌ Error fatal dentro de saveBackup:', err);
    }
}

async function loadBackup() {
    if (!db) return null;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('currentSession');
        request.onerror = () => reject('Error loading backup from DB.');
        request.onsuccess = () => resolve(request.result);
    });
}

async function clearBackup() {
    if (!db) return;
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    updateBackupStatusUI();
}

async function checkForBackup() {
    try {
        await openDb();
        const backup = await loadBackup();
        if (backup && backup.poEntries && backup.poEntries.length > 0) {
            restoreBackupModal.classList.remove('hidden');
        }
        updateBackupStatusUI();
    } catch (error) {
        console.error('Backup check failed:', error);
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
