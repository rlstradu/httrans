// js/main.js
// Application entry point: this file must load LAST (see index.html's
// <script> order) since it's the one that kicks off DOMContentLoaded
// wiring, but every other file's top-level `function`/`const` declarations
// are already reachable by then.
//
// This is a set of plain classic <script> files, not ES modules — no
// import/export anywhere. Every file below is loaded via a plain
// <script src="..."> tag in index.html, in dependency order, and they all
// share the same top-level scope. A `function foo() {}` declared in any of
// these files is automatically reachable both as a bare `foo()` call from
// later files AND as `window.foo`, which is what lets the alignment
// wizard's dynamically-built HTML (onclick="mergeLine(...)" /
// onclick="insertEmptyLine(...)" in js/alignment.js) keep working with no
// extra wiring here. Pandoria's original single-file version didn't use
// ES modules either, so this split doesn't fix a bug the way it did for
// PandaTerm — it's kept this way anyway, on purpose: converting to real
// `type="module"` imports later would silently break the app when opened
// via file:// (double-click), since browsers block ES module imports over
// that protocol. Keep everything here as classic scripts.

document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentTheme);
    populateIsoLanguagesDatalist();
    setLanguage(currentLanguage);
    initVersionButton();

    // Event Listeners
    newTmxBtn.addEventListener('click', handleNewTmxClick);
    alignBtn.addEventListener('click', showAlignmentView);
    themeToggleButton.addEventListener('click', toggleTheme);
    confirmLanguagesBtn.addEventListener('click', confirmLanguages);
    tmxFileInput.addEventListener('change', handleFileLoad);
    downloadTmxBtn.addEventListener('click', downloadTMX);
    searchTermInput.addEventListener('input', () => renderTM(translationMemory, false));
    addEntryBtn.addEventListener('click', addEntry);
    undoBtn.addEventListener('click', undoLastAction);
    messageCloseBtn.addEventListener('click', () => messageBox.style.display = 'none');
    langEnBtn.addEventListener('click', () => setLanguage('en'));
    langEsBtn.addEventListener('click', () => setLanguage('es'));
    confirmCancelBtn.addEventListener('click', () => confirmModal.style.display = 'none');

    // Listeners importación de código
    importCodeBtn.addEventListener('click', openImportCodeModal);
    cancelImportCodeBtn.addEventListener('click', () => importCodeModal.style.display = 'none');
    codeImportArea.addEventListener('input', validateCodeInput);
    processImportCodeBtn.addEventListener('click', processPastedCode);

    // Listeners de alineación
    startAlignmentBtn.addEventListener('click', performAlignment);
    sourceFileInput.addEventListener('change', (e) => handleAlignmentFileUpload(e, 'src'));
    targetFileInput.addEventListener('change', (e) => handleAlignmentFileUpload(e, 'tgt'));
    wizardCancelBtn.addEventListener('click', () => alignmentWizardModal.style.display = 'none');
    wizardConfirmBtn.addEventListener('click', () => {
        alignmentWizardModal.style.display = 'none';
        performAlignment();
    });

    // Listener del botón de versión / modal de novedades
    versionBtn.addEventListener('click', showChangelogModal);
    changelogCloseBtn.addEventListener('click', () => changelogModal.style.display = 'none');

    // Listeners para backup
    sourceTextArea.addEventListener('input', saveBackup);
    targetTextArea.addEventListener('input', saveBackup);
    alignSrcLang.addEventListener('input', saveBackup);
    alignTgtLang.addEventListener('input', saveBackup);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undoLastAction();
        }
    });

    updateUndoButton();
    checkBackup();
});
