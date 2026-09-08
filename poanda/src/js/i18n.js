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

/**
 * Ya no hay nada que desplazar.
 *
 * Los paneles eran ventanas flotantes y el editor tenía que apartarse con
 * relleno para que no lo taparan. Ahora son columnas: el editor se queda con lo
 * que sobra y el navegador reparte solo. Se mantiene el nombre porque lo llaman
 * media docena de sitios, y quitarlo de todos ellos no cambiaría nada.
 */
function updateMainContentOffset() {}

export { setLanguage, updateMainContentOffset };
