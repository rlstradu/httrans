import { enderezarGlosario, generarTBX, leerTBX, tieneFicha } from './core/tbx.js';
import { escaparHtml } from './core/xml.js';
import { hideLoadingOverlay, showLoadingOverlay, showMessage } from './dialogs.js';
import { glossaryTableBody, buscarPaneles, tbxFileInput } from './dom.js';
import { abrirFichaDeTermino } from './termino-modal.js';
import { pintarParDelProyecto } from './idiomas-proyecto.js';
import { avisarSiEstanVacios } from './paneles.js';
import { renderTranslations, repintarTodosLosOriginales } from './editor.js';
import { state } from './state.js';
import { updateStatsDisplay } from './stats.js';
import { showTMInternalMessage } from './tm.js';
import { translations } from './translations.js';

function resetGlossary() {
    state.glossary = [];
    renderGlossary();
    renderTranslations(state.poEntries);
    updateStatsDisplay();
}

/**
 * Deja a la vista el par de idiomas del proyecto y repinta la lista.
 *
 * El glosario ya no pregunta idiomas: los toma del proyecto. Preguntarlos aquí
 * era pedir por segunda vez un dato que el proyecto ya tiene, y abría la puerta
 * a que el glosario dijera una cosa y la memoria otra.
 */
function showGlossaryEditorSection() {
    pintarParDelProyecto('glosarioParIdiomas');
    renderGlossary();
}

/**
 * Repinta lo que depende del glosario.
 *
 * El original de TODOS los segmentos se vuelve a pintar, no solo el activo: el
 * amarillo del glosario está en todo el archivo, así que añadir o quitar un
 * término cambia lo que se ve de arriba abajo.
 */
function alCambiarElGlosario() {
    renderGlossary();
    repintarTodosLosOriginales();
}

function deleteTerm(index) {
    state.glossary.splice(index, 1);
    alCambiarElGlosario();
}

function renderGlossary() {
    if (!glossaryTableBody) {
        console.warn('glossaryTableBody element not found. Cannot render glossary.');
        return;
    }
    avisarSiEstanVacios();

    const search = buscarPaneles ? buscarPaneles.value.toLowerCase().trim() : '';
    glossaryTableBody.innerHTML = '';

    // Se busca también en la definición y en las notas: si alguien apuntó
    // "no traducir como fichero", buscar "fichero" tiene que llevar hasta ese
    // término, que es justo para lo que se escribió la nota.
    const filteredGlossary = state.glossary.filter((entry) =>
        ['srcTerm', 'tgtTerm', 'definition', 'notes'].some((campo) =>
            (entry[campo] || '').toLowerCase().includes(search),
        ),
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

    const t = translations[state.currentLanguage];

    /**
     * Una fila de la lista.
     *
     * La fila entera abre la ficha del término: corregir una errata ya no
     * obliga a borrar el término y volver a escribirlo. El botón de borrar
     * sigue donde estaba, y corta el clic para no abrir la ficha de algo que se
     * está quitando.
     */
    const pintarFila = (entry, resaltada) => {
        const indice = state.glossary.indexOf(entry);
        const row = document.createElement('tr');
        row.className = `glosario-fila${resaltada ? ' glossary-row-highlight' : ''}`;
        row.dataset.glossaryIndex = String(indice);
        row.tabIndex = 0;
        row.title = t['edit_term_hint'] || '';
        // La marca de que el término tiene ficha: sin abrirlo no había manera
        // de saber cuáles están documentados y cuáles son un par de palabras.
        const marca = tieneFicha(entry) ? '<span class="glosario-ficha" aria-hidden="true"></span>' : '';
        row.innerHTML = `
                    <td>${escaparHtml(entry.srcTerm || '')}${marca}</td>
                    <td>${escaparHtml(entry.tgtTerm || '')}</td>
                    <td><button class="glossary-delete-btn" data-glossary-index="${indice}">${t['delete_button']}</button></td>
                `;
        glossaryTableBody.appendChild(row);
    };

    highlightedTerms.forEach((entry) => pintarFila(entry, true));
    otherTerms.forEach((entry) => pintarFila(entry, false));

    // La lista solo sale cuando tiene algo que enseñar, igual que la de la
    // memoria: con el glosario vacío ya lo explica el aviso de arriba, y una
    // tabla de cabeceras sueltas solo ocupa sitio.
    document
        .getElementById('glosarioResultados')
        ?.classList.toggle('hidden', filteredGlossary.length === 0);

    // Los botones de borrar se crean aquí, así que hay que engancharlos aquí.
    // Antes usaban onclick="deleteTerm(...)" en el HTML, que dejó de funcionar
    // al pasar a módulos ES (las funciones ya no son globales).
    glossaryTableBody.querySelectorAll('.glossary-delete-btn').forEach((btn) => {
        btn.addEventListener('click', (evento) => {
            evento.stopPropagation();
            deleteTerm(Number(btn.dataset.glossaryIndex));
        });
    });

    glossaryTableBody.querySelectorAll('.glosario-fila').forEach((fila) => {
        const abrir = () => abrirFichaDeTermino(Number(fila.dataset.glossaryIndex));
        fila.addEventListener('click', abrir);
        fila.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                abrir();
            }
        });
    });
}

function downloadTBX() {
    if (state.glossary.length === 0 && (!state.sourceLang || !state.targetLang)) {
        showMessage(
            translations[state.currentLanguage]['cannot_download_empty_or_unconfigured_glossary'],
        );
        return;
    }
    showLoadingOverlay(translations[state.currentLanguage]['saving_file']);
    try {
        const tbx = generarTBX(state.glossary, {
            origen: state.sourceLang,
            destino: state.targetLang,
        });
        const blob = new Blob([tbx], { type: 'application/xml' });
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
        // Una memoria no es un glosario, y confundirse de botón es lo más fácil
        // del mundo con los dos paneles a la vista.
        if (/<tu[\s>]/.test(content) && !/<termEntry[\s>]|<conceptEntry[\s>]/.test(content)) {
            showTMInternalMessage(
                translations[state.currentLanguage]['tbx_file_expected_tmx_found'],
                true,
            );
            throw new Error('Attempted to load TMX into Glossary.');
        }

        const { terminos } = leerTBX(content);
        // Los idiomas que traiga el TBX no cambian los del proyecto: el par lo
        // manda el proyecto, y un glosario en otra variante sigue sirviendo
        // (ver mismoIdioma en core/idiomas.js). Lo que sí se hace es enderezar
        // las entradas que vengan del revés, para que todas se busquen en el
        // texto original y no la mitad al aire.
        state.glossary = enderezarGlosario(terminos);

        if (state.glossary.length === 0) {
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
    alCambiarElGlosario,
    downloadTBX,
    loadTBX,
    processTBXContent,
    renderGlossary,
    resetGlossary,
    showGlossaryEditorSection,
};
