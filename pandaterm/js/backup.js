// js/backup.js
// Autosave/restore of the working glossary to localStorage, so a browser
// refresh or crash doesn't lose unsaved work. Independent of the TBX/CSV
// export flow, this is purely a local safety net.

/**
 * Saves the current glossary (and its language pair) to localStorage.
 */
function saveBackupToLocalStorage() {
  try {
    const backupData = {
      glossary: state.glossary,
      sourceLang: state.glossarySourceLanguage,
      targetLang: state.glossaryTargetLanguage
    };
    localStorage.setItem('pandaTermBackup', JSON.stringify(backupData));
    console.log('Backup guardado en localStorage.');
  } catch (e) {
    console.error('Error al guardar el backup en localStorage:', e);
  }
}

/**
 * Loads a previously saved backup, if any.
 * @returns {{success: boolean, data: (Object|null), error: (string|null)}}
 */
function loadBackupFromLocalStorage() {
  try {
    const backupString = localStorage.getItem('pandaTermBackup');
    if (!backupString) {
      return { success: false, data: null, error: 'nobackup' };
    }
    const backupData = JSON.parse(backupString);
    if (backupData && backupData.glossary && backupData.sourceLang && backupData.targetLang) {
      console.log('Backup data found.');
      return { success: true, data: backupData, error: null };
    } else {
      console.warn('Backup en localStorage corrupto o incompleto.');
      return { success: false, data: null, error: 'corrupt' };
    }
  } catch (e) {
    console.error('Error al cargar o parsear el backup de localStorage:', e);
    return { success: false, data: null, error: 'corrupt' };
  }
}
