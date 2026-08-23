// js/main.js
// Application entry point: this file must load LAST (see index.html's
// <script> order) since it's the one that kicks off DOMContentLoaded
// wiring, but every other file's top-level `function` declarations are
// already reachable by then. Restores the last session's backup (with
// the same confirm/discard prompt as before) and binds the app's
// initial event listeners.
//
// This is a set of plain classic <script> files, not ES modules — no
// import/export anywhere. Every file below is loaded via a plain
// <script src="..."> tag in index.html, in dependency order, and they
// all share the same top-level scope, the same way the original single
// inline <script> block did. A `function foo() {}` declared in any of
// these files is automatically reachable both as a bare `foo()` call
// from later files AND as `window.foo`, which is what lets index.html's
// onclick="foo()" attributes (both the static ones in the markup and
// the ones built into the HTML strings the modal-building functions
// inject) keep working with no extra wiring here. (An earlier version of
// this refactor used real ES modules with import/export, which is
// cleaner in principle, but browsers block ES module imports over the
// file:// protocol — so double-clicking index.html produced a
// completely dead page. Classic scripts don't have that restriction,
// which is why this split keeps the "just open the file" simplicity the
// original single-file version had.)

document.addEventListener('DOMContentLoaded', () => {
  // 1. Configurar idioma de la UI
  if (!localStorage.getItem('language')) {
    localStorage.setItem('language', 'en');
    state.currentUILanguage = 'en';
  }

  // 2. Aplicar tema e idioma (necesario antes de la lógica de backup)
  applyTheme(state.currentTheme);
  setUILanguage(state.currentUILanguage);

  // 3. Intentar cargar backup
  const backupResult = loadBackupFromLocalStorage();

  // 4. Poblar datalist de idiomas
  populateIsoLanguagesDatalist();

  // 5. Decidir qué pantalla mostrar (lógica de confirmación de backup)
  if (backupResult.success) {
    // Backup encontrado, preguntar al usuario
    const backupData = backupResult.data;
    const termCount = backupData.glossary.length;

    const title = translations[state.currentUILanguage]['backup_confirm_title'];
    let message = translations[state.currentUILanguage]['backup_confirm_text'];
    message = message.replace('{count}', termCount);
    const confirmBtnText = translations[state.currentUILanguage]['backup_confirm_button'];
    const cancelBtnText = translations[state.currentUILanguage]['backup_discard_button'];

    const restoreAction = () => {
      // Usuario pulsa "Restaurar"
      state.glossary = backupData.glossary;
      state.glossarySourceLanguage = backupData.sourceLang;
      state.glossaryTargetLanguage = backupData.targetLang;

      document.getElementById('configSrcLang').value = state.glossarySourceLanguage;
      document.getElementById('configTgtLang').value = state.glossaryTargetLanguage;
      document.getElementById('displaySrcLang').value = state.glossarySourceLanguage;
      document.getElementById('displayTgtLang').value = state.glossaryTargetLanguage;
      showSection('editorSection');
      renderGlossary();
      showToast(translations[state.currentUILanguage]['backup_restored']);
    };

    const discardAction = () => {
      // Usuario pulsa "Descartar"
      localStorage.removeItem('pandaTermBackup');
      showSection('languageConfigSection');
    };

    showConfirmationDialog(title, message, restoreAction, discardAction, confirmBtnText, cancelBtnText, 'btn-primary');

  } else {
    // No hay backup o está corrupto
    if (backupResult.error === 'corrupt') {
      localStorage.removeItem('pandaTermBackup');
      console.warn('Se eliminó un backup corrupto de localStorage.');
      showToast(translations[state.currentUILanguage]['backup_corrupt']);
    }
    // Mostrar la configuración inicial de idioma
    showSection('languageConfigSection');
  }

  // 6. Configurar listeners
  updateUndoButtonState();

  // Listener para el input de archivo (centralizado)
  const fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
      fileInput.value = '';
      return;
    }

    if (!state.glossarySourceLanguage || !state.glossaryTargetLanguage) {
      showMessageBox(translations[state.currentUILanguage]['lang_config_required']);
      showSection('languageConfigSection');
      fileInput.value = '';
      return;
    }

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.tbx') || fileName.endsWith('.xml')) {
      console.log(`Importando TBX: ${file.name}`);
      readTBXFile(file);
    } else if (fileName.endsWith('.csv')) {
      console.log(`Importando CSV: ${file.name}`);
      readCSVFile(file);
    } else {
      console.warn(`Unsupported file type: ${fileName}`);
      showMessageBox(translations[state.currentUILanguage]['unsupported_file_error']);
    }

    fileInput.value = '';
  });

  // Listeners de teclado
  document.getElementById('srcTerm').addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('tgtTerm').focus(); });
  document.getElementById('tgtTerm').addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('definition').focus(); });
  document.getElementById('definition').addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('notes').focus(); });
  document.getElementById('notes').addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('partOfSpeech').focus(); });
  document.getElementById('partOfSpeech').addEventListener('keypress', (e) => { if (e.key === 'Enter') addTerm(); });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
  });

  applyColumnVisibility();
});
