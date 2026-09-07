import { clearBackup } from './backup.js';
import { reconstructPo } from './core/po.js';
import { generateTBX } from './core/tbx.js';
import { generateTMX } from './core/tmx.js';
import { hideLoadingOverlay, showConfirm, showLoadingOverlay, showMessage } from './dialogs.js';
import {
    projectFileInput,
    projectFilenameInput,
    saveProjectModal,
    statsContainer,
    terminologySidebar,
    translationMemorySidebar,
} from './dom.js';
import { renderTranslations } from './editor.js';
import { processPoContent, updateSaveButtonsState } from './files.js';
import { processTBXContent, resetGlossary } from './glossary.js';
import { updateMainContentOffset } from './i18n.js';
import { olvidarProyecto } from './persistencia.js';
import { fijarIdiomas, pintarParDeIdiomas } from './idiomas-proyecto.js';
import { normalizarIdioma } from './core/idiomas.js';
import { state } from './state.js';
import { updateStatsDisplay, updateUtilityButtonStates } from './stats.js';
import { processTMXContent, resetTM } from './tm.js';
import { translations } from './translations.js';

function resetProjectState() {
    olvidarProyecto();
    state.poEntries = [];
    state.currentFileName = 'translations.po';

    state.currentFileType = null;
    state.currentJsonSourceFileName = null;
    state.currentJsonTargetFileName = null;
    state.sourceLang = '';
    state.targetLang = '';
    pintarParDeIdiomas();

    renderTranslations([]);
    updateStatsDisplay();

    resetGlossary();
    resetTM();

    terminologySidebar.classList.remove('show-sidebar');
    translationMemorySidebar.classList.remove('show-sidebar');
    statsContainer.classList.remove('show');
    updateMainContentOffset();
    updateUtilityButtonStates();
    updateSaveButtonsState();
}

async function newProject() {
    if (await showConfirm(translations[state.currentLanguage]['new_project_confirm'])) {
        resetProjectState();
        clearBackup();
    }
}

function showSaveProjectModal() {
    if (state.poEntries.length === 0) {
        showMessage(translations[state.currentLanguage]['no_project_to_save']);
        return;
    }
    projectFilenameInput.value = state.currentFileName.replace(/\.po$/i, '');
    saveProjectModal.classList.remove('hidden');
    projectFilenameInput.focus();
}

async function executeSaveProject() {
    const filename = projectFilenameInput.value.trim();
    if (!filename) {
        showMessage(translations[state.currentLanguage]['enter_filename']);
        return;
    }

    showLoadingOverlay(translations[state.currentLanguage]['saving_file']);
    try {
        const zip = new JSZip();

        const poContent = reconstructPo(state.poEntries);
        zip.file(state.currentFileName, poContent);

        const tmxContent = generateTMX();
        if (tmxContent) {
            zip.file('memory.tmx', tmxContent);
        }

        if (state.glossary.length > 0) {
            const tbxContent = generateTBX();
            zip.file('glossary.tbx', tbxContent);
        }

        // El par de idiomas del proyecto. Un .poanda que no lo lleve se abre
        // sin dirección y hay que volver a decirla, cuando es justo el dato que
        // define de qué va el encargo.
        zip.file(
            'poanda.json',
            JSON.stringify({ sourceLang: state.sourceLang, targetLang: state.targetLang }, null, 2),
        );

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.poanda`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        saveProjectModal.classList.add('hidden');
        showMessage(translations[state.currentLanguage]['project_saved']);
    } catch (error) {
        showMessage(
            translations[state.currentLanguage]['error_saving_project'] + ': ' + error.message,
        );
        console.error('Error saving project:', error);
    } finally {
        hideLoadingOverlay();
    }
}

async function openProject(file) {
    if (!file) return;

    showLoadingOverlay(translations[state.currentLanguage]['loading_project']);
    try {
        resetProjectState();

        const zip = await JSZip.loadAsync(file);
        let poFileFound = false;

        // El par de idiomas se lee antes que nada: processPoContent crea el
        // proyecto y ahí ya tiene que estar puesto.
        const datos = zip.file('poanda.json');
        if (datos) {
            try {
                const guardado = JSON.parse(await datos.async('string'));
                await fijarIdiomas(
                    {
                        origen: normalizarIdioma(guardado.sourceLang || ''),
                        destino: normalizarIdioma(guardado.targetLang || ''),
                    },
                    { guardar: false },
                );
            } catch {
                // Un poanda.json roto no impide abrir el proyecto: se pregunta
                // el par desde el indicador de la barra y listo.
            }
        }

        const promises = [];
        zip.forEach((relativePath, zipEntry) => {
            const fileNameLower = zipEntry.name.toLowerCase();
            if (fileNameLower.endsWith('.po')) {
                poFileFound = true;
                state.currentFileName = zipEntry.name;
                promises.push(zipEntry.async('string').then(processPoContent));
            } else if (fileNameLower.endsWith('.tmx')) {
                promises.push(zipEntry.async('string').then(processTMXContent));
            } else if (fileNameLower.endsWith('.tbx')) {
                promises.push(zipEntry.async('string').then(processTBXContent));
            }
        });

        await Promise.all(promises);

        if (!poFileFound) {
            throw new Error(translations[state.currentLanguage]['invalid_project_file']);
        }
        showMessage(translations[state.currentLanguage]['project_loaded']);
        await clearBackup();
    } catch (error) {
        showMessage(
            translations[state.currentLanguage]['error_opening_project'] + ': ' + error.message,
        );
        console.error('Error opening project:', error);
        resetProjectState();
    } finally {
        hideLoadingOverlay();
        projectFileInput.value = '';
    }
}

export { executeSaveProject, newProject, openProject, resetProjectState, showSaveProjectModal };
