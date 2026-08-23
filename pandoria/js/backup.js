// js/backup.js
// Autosave/restore of the editor or alignment view to localStorage, so a
// closed tab or refresh doesn't lose unsaved work. Same behavior as the
// original single-file version.

const BACKUP_KEY = 'pandoriaBackup';

function saveBackup() {
    if (!editorSection.classList.contains('hidden')) {
        const backupState = {
            view: 'editor',
            timestamp: Date.now(),
            editorData: {
                translationMemory: translationMemory,
                tmSourceLanguage: tmSourceLanguage,
                tmTargetLanguage: tmTargetLanguage
            },
            uiLang: currentLanguage
        };
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backupState));
    } else if (!alignmentSection.classList.contains('hidden')) {
        const backupState = {
            view: 'alignment',
            timestamp: Date.now(),
            alignmentData: {
                sourceText: sourceTextArea.value,
                targetText: targetTextArea.value,
                alignSrcLang: alignSrcLang.value,
                alignTgtLang: alignTgtLang.value
            },
            uiLang: currentLanguage
        };
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backupState));
    }
}

function clearBackup() {
    localStorage.removeItem(BACKUP_KEY);
}

function checkBackup() {
    const backupData = localStorage.getItem(BACKUP_KEY);
    if (backupData) {
        try {
            const parsedData = JSON.parse(backupData);
            const promptLang = parsedData.uiLang || 'es';

            restoreTitle.textContent = translations[promptLang]['restore_title'];
            restoreText.textContent = translations[promptLang]['restore_text'];
            restoreDiscardBtn.textContent = translations[promptLang]['discard'];
            restoreProceedBtn.textContent = translations[promptLang]['restore'];

            restoreModal.style.display = 'flex';

            restoreDiscardBtn.onclick = () => {
                clearBackup();
                restoreModal.style.display = 'none';
            };
            restoreProceedBtn.onclick = () => {
                restoreBackup(parsedData);
                restoreModal.style.display = 'none';
            };

        } catch (error) {
            console.error('Backup corrupto, eliminando:', error);
            clearBackup();
        }
    }
}

function restoreBackup(data) {
    try {
        setLanguage(data.uiLang || 'es');

        if (data.view === 'editor' && data.editorData) {
            translationMemory = data.editorData.translationMemory;
            tmSourceLanguage = data.editorData.tmSourceLanguage;
            tmTargetLanguage = data.editorData.tmTargetLanguage;

            // Backups saved by an older version may hold entries with no
            // `id` field yet (added when the duplicate-row bug was fixed).
            // Backfill one so the rest of the app can rely on every entry
            // always having a stable id.
            translationMemory.forEach(entry => {
                if (!entry.id) entry.id = generateEntryId();
            });

            displaySrcLangSpan.textContent = tmSourceLanguage;
            displayTgtLangSpan.textContent = tmTargetLanguage;

            historyStack = [];
            updateUndoButton();

            languageConfigSection.style.display = 'none';
            alignmentSection.classList.add('hidden');
            editorSection.classList.remove('hidden');
            renderTM(translationMemory, false);

        } else if (data.view === 'alignment' && data.alignmentData) {
            sourceTextArea.value = data.alignmentData.sourceText;
            targetTextArea.value = data.alignmentData.targetText;
            alignSrcLang.value = data.alignmentData.alignSrcLang;
            alignTgtLang.value = data.alignmentData.alignTgtLang;

            languageConfigSection.style.display = 'none';
            editorSection.classList.add('hidden');
            alignmentSection.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error al restaurar el backup:', error);
        showMessage('Error al restaurar el backup. Empezando de cero.');
        clearBackup();
        resetTM();
    }
}
