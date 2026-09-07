import { isoLanguagesData } from './core/iso-languages.js';
import { generateTBX } from './core/tbx.js';
import { hideLoadingOverlay, showLoadingOverlay, showMessage } from './dialogs.js';
import {
    configSrcLang,
    configTgtLang,
    displaySrcLang,
    displayTgtLang,
    glossaryTableBody,
    isoLanguagesDatalist,
    searchTermInput,
    srcTermInput,
    tbxFileInput,
    terminologyEditorSection,
    terminologyLanguageConfigSection,
    tgtTermInput,
} from './dom.js';
import { renderTranslations } from './editor.js';
import { state } from './state.js';
import { updateStatsDisplay } from './stats.js';
import { showTMInternalMessage } from './tm.js';
import { translations } from './translations.js';

function populateIsoLanguagesDatalist() {
    isoLanguagesDatalist.innerHTML = '';
    isoLanguagesData.forEach((lang) => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.name;
        isoLanguagesDatalist.appendChild(option);
    });
}

function resetGlossary() {
    state.glossary = [];
    state.glossarySourceLanguage = '';
    state.glossaryTargetLanguage = '';
    if (configSrcLang) configSrcLang.value = 'en-US';
    if (configTgtLang) configTgtLang.value = 'es-ES';
    if (srcTermInput) srcTermInput.value = '';
    if (tgtTermInput) tgtTermInput.value = '';
    if (searchTermInput) searchTermInput.value = '';

    if (terminologyLanguageConfigSection && terminologyEditorSection) {
        terminologyLanguageConfigSection.style.display = 'block';
        terminologyEditorSection.style.display = 'none';
    }

    renderGlossary();
    renderTranslations(state.poEntries);
    updateStatsDisplay();
}

function showLanguageConfigSection() {
    if (terminologyLanguageConfigSection && terminologyEditorSection) {
        terminologyLanguageConfigSection.style.display = 'block';
        terminologyEditorSection.style.display = 'none';
    }
}

function showGlossaryEditorSection() {
    if (
        terminologyLanguageConfigSection &&
        terminologyEditorSection &&
        displaySrcLang &&
        displayTgtLang
    ) {
        terminologyLanguageConfigSection.style.display = 'none';
        terminologyEditorSection.style.display = 'block';
        displaySrcLang.value = state.glossarySourceLanguage;
        displayTgtLang.value = state.glossaryTargetLanguage;
        renderGlossary();
    }
}

function confirmGlossaryLanguages() {
    const srcLang = configSrcLang ? configSrcLang.value.trim() : '';
    const tgtLang = configTgtLang ? configTgtLang.value.trim() : '';

    if (!srcLang || !tgtLang) {
        showMessage(translations[state.currentLanguage]['lang_config_required']);
        return;
    }

    state.glossarySourceLanguage = srcLang;
    state.glossaryTargetLanguage = tgtLang;

    showGlossaryEditorSection();
    renderTranslations(state.poEntries);
}

function addTerm() {
    const srcTerm = srcTermInput ? srcTermInput.value.trim() : '';
    const tgtTerm = tgtTermInput ? tgtTermInput.value.trim() : '';

    if (!srcTerm || !tgtTerm) {
        showMessage(translations[state.currentLanguage]['both_terms_required']);
        return;
    }

    state.glossary.push({
        srcLang: state.glossarySourceLanguage,
        srcTerm: srcTerm,
        tgtLang: state.glossaryTargetLanguage,
        tgtTerm: tgtTerm,
    });
    if (srcTermInput) srcTermInput.value = '';
    if (tgtTermInput) tgtTermInput.value = '';
    renderGlossary();
    renderTranslations(state.poEntries);
}

function deleteTerm(index) {
    state.glossary.splice(index, 1);
    renderGlossary();
    renderTranslations(state.poEntries);
}

function renderGlossary() {
    if (!glossaryTableBody) {
        console.warn('glossaryTableBody element not found. Cannot render glossary.');
        return;
    }
    const search = searchTermInput ? searchTermInput.value.toLowerCase() : '';
    glossaryTableBody.innerHTML = '';

    const filteredGlossary = state.glossary.filter(
        (entry) =>
            (entry.srcTerm && entry.srcTerm.toLowerCase().includes(search)) ||
            (entry.tgtTerm && entry.tgtTerm.toLowerCase().includes(search)),
    );

    const highlightedTerms = [];
    const otherTerms = [];

    filteredGlossary.forEach((entry) => {
        if (entry.srcTerm && state.termsFoundInActiveSegment.has(entry.srcTerm)) {
            highlightedTerms.push(entry);
        } else {
            otherTerms.push(entry);
        }
    });

    state.currentGlossaryLatestResults = [
        ...highlightedTerms,
        ...otherTerms.sort((a, b) => a.srcTerm.localeCompare(b.srcTerm)),
    ];

    highlightedTerms.forEach((entry, i) => {
        const row = document.createElement('tr');
        row.classList.add('glossary-row-highlight');
        row.innerHTML = `
                    <td>${entry.srcTerm}</td>
                    <td>${entry.tgtTerm}</td>
                    <td><button class="glossary-delete-btn" data-glossary-index="${state.glossary.indexOf(entry)}">${translations[state.currentLanguage]['delete_button']}</button></td>
                `;
        glossaryTableBody.appendChild(row);
    });

    otherTerms.forEach((entry, i) => {
        const row = document.createElement('tr');
        row.innerHTML = `
                    <td>${entry.srcTerm}</td>
                    <td>${entry.tgtTerm}</td>
                    <td><button class="glossary-delete-btn" data-glossary-index="${state.glossary.indexOf(entry)}">${translations[state.currentLanguage]['delete_button']}</button></td>
                `;
        glossaryTableBody.appendChild(row);
    });

    // Los botones de borrar se crean aquí, así que hay que engancharlos aquí.
    // Antes usaban onclick="deleteTerm(...)" en el HTML, que dejó de funcionar
    // al pasar a módulos ES (las funciones ya no son globales).
    glossaryTableBody.querySelectorAll('.glossary-delete-btn').forEach((btn) => {
        btn.addEventListener('click', () => deleteTerm(Number(btn.dataset.glossaryIndex)));
    });
}

function downloadTBX() {
    if (
        state.glossary.length === 0 &&
        (!state.glossarySourceLanguage || !state.glossaryTargetLanguage)
    ) {
        showMessage(
            translations[state.currentLanguage]['cannot_download_empty_or_unconfigured_glossary'],
        );
        return;
    }
    showLoadingOverlay(translations[state.currentLanguage]['saving_file']);
    try {
        const blob = new Blob([generateTBX()], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'glossary.tbx';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        showMessage(translations[state.currentLanguage]['tbx_saved_successfully']);
    } catch (error) {
        showMessage(`${translations[state.currentLanguage]['error_saving_file']} ${error.message}`);
        console.error('Error downloading TBX:', error);
    } finally {
        hideLoadingOverlay();
    }
}

function loadTBX() {
    if (!tbxFileInput) {
        console.warn('tbxFileInput element not found. Cannot load TBX.');
        return;
    }
    tbxFileInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const content = await file.text();
        processTBXContent(content);
    };
    tbxFileInput.click();
}

function processTBXContent(content) {
    showLoadingOverlay(translations[state.currentLanguage]['loading_file']);
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'application/xml');

        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            const errorText = xmlDoc.getElementsByTagName('parsererror')[0].textContent;
            throw new Error('Invalid XML/TBX format: ' + errorText);
        }

        if (xmlDoc.getElementsByTagName('tu').length > 0) {
            showTMInternalMessage(
                translations[state.currentLanguage]['tbx_file_expected_tmx_found'],
                true,
            );
            throw new Error('Attempted to load TMX into Glossary.');
        }

        const entries = xmlDoc.getElementsByTagName('termEntry');
        state.glossary = [];
        let firstEntryLangs = { src: '', tgt: '' };

        if (entries.length > 0) {
            const firstSets = entries[0].getElementsByTagName('LangSet');
            if (firstSets.length >= 2) {
                firstEntryLangs.src = firstSets[0].getAttribute('xml:lang');
                firstEntryLangs.tgt = firstSets[1].getAttribute('xml:lang');
            }
        }

        for (let entry of entries) {
            const sets = entry.getElementsByTagName('LangSet');
            if (sets.length >= 2) {
                const lang1 = sets[0].getAttribute('xml:lang');
                const term1 =
                    sets[0].getElementsByTagName('tig')[0]?.getElementsByTagName('term')[0]
                        ?.textContent || '';
                const lang2 = sets[1].getAttribute('xml:lang');
                const term2 =
                    sets[1].getElementsByTagName('tig')[0]?.getElementsByTagName('term')[0]
                        ?.textContent || '';
                state.glossary.push({
                    srcLang: lang1,
                    srcTerm: term1,
                    tgtLang: lang2,
                    tgtTerm: term2,
                });
            }
        }

        if (state.glossary.length > 0 && firstEntryLangs.src && firstEntryLangs.tgt) {
            state.glossarySourceLanguage = firstEntryLangs.src;
            state.glossaryTargetLanguage = firstEntryLangs.tgt;
        } else if (state.glossary.length === 0) {
            showMessage(translations[state.currentLanguage]['error_loading_tbx_file']);
        }

        showGlossaryEditorSection();
        renderTranslations(state.poEntries);
    } catch (error) {
        console.error('Error loading TBX file:', error);
        if (!error.message.includes('Attempted to load TMX')) {
            showMessage(translations[state.currentLanguage]['error_loading_tbx_file']);
        }
        resetGlossary();
    } finally {
        hideLoadingOverlay();
    }
}

export {
    addTerm,
    confirmGlossaryLanguages,
    downloadTBX,
    loadTBX,
    populateIsoLanguagesDatalist,
    processTBXContent,
    renderGlossary,
    resetGlossary,
    showGlossaryEditorSection,
    showLanguageConfigSection,
};
