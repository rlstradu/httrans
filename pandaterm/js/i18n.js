// js/i18n.js
// UI language switching: applies translations to every [data-i18n] /
// [data-i18n-placeholder] element, and populates the ISO language
// datalist used by the source/target language inputs.

/**
 * Populates the datalist with ISO language codes and names.
 */
function populateIsoLanguagesDatalist() {
  const datalist = document.getElementById('isoLanguages');
  datalist.innerHTML = '';
  isoLanguagesData.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    datalist.appendChild(option);
  });
}

/**
 * Updates the active state of language switcher buttons.
 */
function updateLanguageButtons() {
  document.getElementById('langBtnEN').classList.toggle('active', state.currentUILanguage === 'en');
  document.getElementById('langBtnES').classList.toggle('active', state.currentUILanguage === 'es');
}

/**
 * Updates all elements with `data-i18n` and `data-i18n-placeholder` attributes
 * to the current UI language.
 */
function updateTextContent() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[state.currentUILanguage][key]) {
      // Si el elemento es un header colapsable, preserva la flecha
      if (el.classList.contains('collapsible-header')) {
        const arrow = el.querySelector('.arrow');
        el.textContent = translations[state.currentUILanguage][key];
        if (arrow) {
          el.appendChild(arrow);
        }
      } else {
        el.textContent = translations[state.currentUILanguage][key];
      }
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[state.currentUILanguage][key]) {
      el.placeholder = translations[state.currentUILanguage][key];
    }
  });
  // Update placeholder for partOfSpeech select
  const selectPosPlaceholder = document.querySelector('#partOfSpeech option[value=""]');
  if (selectPosPlaceholder) {
    selectPosPlaceholder.textContent = translations[state.currentUILanguage]['select_pos_placeholder'];
  }

  renderGlossary(); // Re-render glossary to update delete button text
}

/**
 * Sets the UI language and updates all translatable text.
 * @param {string} lang - The language code ('en' or 'es').
 */
function setUILanguage(lang) {
  state.currentUILanguage = lang;
  localStorage.setItem('language', lang);
  updateTextContent();
  updateLanguageButtons();
}
