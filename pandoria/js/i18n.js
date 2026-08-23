// js/i18n.js
// UI language switching (EN/ES) and the ISO language datalist.

function setLanguage(lang) {
    currentLanguage = lang;
    langEnBtn.classList.toggle('active', lang === 'en');
    langEsBtn.classList.toggle('active', lang === 'es');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (translations[lang][key]) el.textContent = translations[lang][key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (translations[lang][key]) el.placeholder = translations[lang][key];
    });

    // Re-validar si el modal de código está abierto para actualizar el texto del estado
    if (importCodeModal.style.display === 'flex') {
        validateCodeInput();
    }

    if (!editorSection.classList.contains('hidden')) {
        renderTM(translationMemory, false);
    }
}

function populateIsoLanguagesDatalist() {
    isoLanguagesDatalist.innerHTML = '';
    isoLanguagesData.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.name;
        isoLanguagesDatalist.appendChild(option);
    });
}
