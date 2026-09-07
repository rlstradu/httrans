import { aiSidebar, centralColumn, terminologySidebar, translationMemorySidebar } from './dom.js';
import { renderTranslations } from './editor.js';
import { renderGlossary } from './glossary.js';
import { state } from './state.js';
import { actualizarBotonTema } from './theme.js';
import { translations } from './translations.js';

function setLanguage(lang) {
    state.currentLanguage = lang;
    document.documentElement.lang = lang;

    // El selector es un desplegable: en el botón se lee el idioma que está
    // puesto, y dentro se marca con una palomita la opción activa. El nombre de
    // cada idioma se escribe en ese mismo idioma (English, Español), como es
    // costumbre en los selectores de idioma: así lo reconoce quien no entiende
    // el idioma en el que está la página ahora mismo.
    const NOMBRES = { en: 'English', es: 'Español' };

    const langEnBtn = document.getElementById('langEnBtn');
    const langEsBtn = document.getElementById('langEsBtn');
    const langActual = document.getElementById('langActual');

    langEnBtn.classList.toggle('active-lang', lang === 'en');
    langEsBtn.classList.toggle('active-lang', lang !== 'en');
    if (langActual) langActual.textContent = NOMBRES[lang] || NOMBRES.en;

    updateTextContent();
    // El botón del tema no se puede traducir con data-i18n: su texto depende
    // también de si estás en claro o en oscuro.
    actualizarBotonTema();
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
