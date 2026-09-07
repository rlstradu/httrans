import { aiSidebar, centralColumn, terminologySidebar, translationMemorySidebar } from './dom.js';
import { renderTranslations } from './editor.js';
import { renderGlossary } from './glossary.js';
import { state } from './state.js';
import { translations } from './translations.js';

function setLanguage(lang) {
    state.currentLanguage = lang;
    document.documentElement.lang = lang;

    const langEnBtn = document.getElementById('langEnBtn');
    const langEsBtn = document.getElementById('langEsBtn');

    langEnBtn.classList.remove('active-lang');
    langEsBtn.classList.remove('active-lang');
    langEnBtn.style.backgroundColor = 'var(--color-medium-gray)';
    langEnBtn.style.color = 'var(--color-dark)';
    langEsBtn.style.backgroundColor = 'var(--color-medium-gray)';
    langEsBtn.style.color = 'var(--color-dark)';

    if (lang === 'en') {
        langEnBtn.classList.add('active-lang');
        langEnBtn.style.backgroundColor = 'var(--color-dark)';
        langEnBtn.style.color = 'var(--color-white)';
    } else {
        langEsBtn.classList.add('active-lang');
        langEsBtn.style.backgroundColor = 'var(--color-dark)';
        langEsBtn.style.color = 'var(--color-white)';
    }

    updateTextContent();
    renderTranslations(state.poEntries);
    renderGlossary();
}

function updateTextContent() {
    const lang = translations[state.currentLanguage];

    // Selector mejorado: busca elementos por texto, placeholder o título
    document
        .querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title]')
        .forEach((element) => {
            // Obtenemos la clave del atributo que esté presente
            const key =
                element.getAttribute('data-i18n') ||
                element.getAttribute('data-i18n-placeholder') ||
                element.getAttribute('data-i18n-title');

            if (lang[key]) {
                if (element.hasAttribute('data-i18n-placeholder')) {
                    element.placeholder = lang[key];
                } else if (element.hasAttribute('data-i18n-title')) {
                    element.title = lang[key];
                } else {
                    element.textContent = lang[key];
                }
            }
        });

    const displaySourceLanguageLabel = document.getElementById('displaySourceLanguageLabel');
    if (displaySourceLanguageLabel)
        displaySourceLanguageLabel.textContent = lang['source_language'];

    const displayTargetLanguageLabel = document.getElementById('displayTargetLanguageLabel');
    if (displayTargetLanguageLabel)
        displayTargetLanguageLabel.textContent = lang['target_language'];

    const displayTmSourceLanguageLabel = document.getElementById('displayTmSourceLanguageLabel');
    if (displayTmSourceLanguageLabel)
        displayTmSourceLanguageLabel.textContent = lang['source_language'];

    const displayTmTargetLanguageLabel = document.getElementById('displayTmTargetLanguageLabel');
    if (displayTmTargetLanguageLabel)
        displayTmTargetLanguageLabel.textContent = lang['target_language'];

    const findReplaceCloseBtnText = document.getElementById('findReplaceCloseBtnText');
    if (findReplaceCloseBtnText) findReplaceCloseBtnText.textContent = lang['close_btn'];
}

function updateMainContentOffset() {
    const isTerminologyOpen = terminologySidebar.classList.contains('show-sidebar');
    const isTranslationMemoryOpen = translationMemorySidebar.classList.contains('show-sidebar');

    if (centralColumn) {
        centralColumn.classList.remove('left-sidebar-active', 'right-sidebar-active');

        if (isTerminologyOpen) {
            centralColumn.classList.add('left-sidebar-active');
            document.documentElement.style.setProperty(
                '--terminology-sidebar-width',
                terminologySidebar.offsetWidth + 'px',
            );
        }
        if (
            isTranslationMemoryOpen ||
            (aiSidebar && aiSidebar.classList.contains('show-sidebar'))
        ) {
            centralColumn.classList.add('right-sidebar-active');
            // Prefer TM width if open, otherwise AI width
            const width = isTranslationMemoryOpen
                ? translationMemorySidebar.offsetWidth
                : aiSidebar.offsetWidth;
            document.documentElement.style.setProperty(
                '--translation-memory-sidebar-width',
                width + 'px',
            );
        }
    } else {
        console.warn('central-column element not found for offset update.');
    }
}

export { setLanguage, updateMainContentOffset };
