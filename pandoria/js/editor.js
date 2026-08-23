// js/editor.js
// Top-level editor lifecycle: creating/resetting a TM and confirming its
// source/target languages before showing the table.

function handleNewTmxClick() {
    if (translationMemory.length > 0) {
        showConfirmDialog(
            translations[currentLanguage]['confirm_new_tmx_title'],
            translations[currentLanguage]['confirm_new_tmx_text'],
            resetTM
        );
    } else {
        resetTM();
    }
}

function resetTM() {
    translationMemory = [];
    historyStack = [];
    updateUndoButton();
    tmSourceLanguage = '';
    tmTargetLanguage = '';
    configSrcLangInput.value = 'en-US';
    configTgtLangInput.value = 'es-ES';
    searchTermInput.value = '';

    alignmentSection.classList.add('hidden');
    languageConfigSection.style.display = 'block';
    editorSection.classList.add('hidden');
    renderTM([], false);
    clearBackup();
}

function confirmLanguages() {
    const srcLang = configSrcLangInput.value.trim();
    const tgtLang = configTgtLangInput.value.trim();

    if (!srcLang || !tgtLang) {
        showMessage(translations[currentLanguage]['enter_lang_codes']);
        return;
    }

    tmSourceLanguage = srcLang;
    tmTargetLanguage = tgtLang;

    displaySrcLangSpan.textContent = tmSourceLanguage;
    displayTgtLangSpan.textContent = tmTargetLanguage;

    historyStack = [];
    updateUndoButton();

    languageConfigSection.style.display = 'none';
    editorSection.classList.remove('hidden');
    renderTM([], false);
    saveBackup();
}
