import { enderezarGlosario, generarTBX, leerTBX, tieneFicha } from './core/tbx.js';
import { escaparHtml } from './core/xml.js';
import { hideLoadingOverlay, showLoadingOverlay, showMessage } from './dialogs.js';
import { glosarioLista, buscarPaneles, tbxFileInput } from './dom.js';
import { terminosQueResponden } from './core/glosario-coincidencias.js';
import { abrirFichaDeTermino } from './termino-modal.js';
import { pintarParDelProyecto } from './idiomas-proyecto.js';
import { avisarSiEstanVacios } from './paneles.js';
import {
    recalcularTerminosDelSegmentoActivo,
    renderTranslations,
    repintarTodosLosOriginales,
} from './editor.js';
import { state } from './state.js';
import { updateStatsDisplay } from './stats.js';
import { showTMInternalMessage } from './tm.js';
import { translations } from './translations.js';

/**
 * Qué hacer al pulsar "Insertar" en una tarjeta (lo pone main.js).
 *
 * Este módulo no sabe dónde está el cursor ni cómo se escribe en un segmento, y
 * no tiene por qué: es la misma función que usa la tarjeta del hover.
 * @type {(texto: string) => boolean}
 */
let alInsertar = () => false;

/** @param {(texto: string) => boolean} funcion */
function alInsertarDesdeElGlosario(funcion) {
    alInsertar = funcion;
}

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
    // Primero se vuelve a mirar qué hay en el segmento en el que se está: el
    // panel señala las coincidencias a partir de esa lista, y si no se rehace,
    // un término recién guardado no sale marcado hasta salir del segmento y
    // volver a entrar.
    recalcularTerminosDelSegmentoActivo();
    renderGlossary();
    repintarTodosLosOriginales();
}

function deleteTerm(index) {
    state.glossary.splice(index, 1);
    alCambiarElGlosario();
}

/**
 * Una tarjeta de término.
 *
 * La forma viene de Locversia: arriba el término con su categoría y el botón de
 * insertar; debajo la traducción, destacada, porque es lo que se va a escribir;
 * y al final la definición y las notas, que son lo que explica por qué esa
 * traducción y no otra. Antes era una fila de una tabla de tres columnas: en
 * media columna, cada celda daba para cuatro palabras, y la definición y las
 * notas no salían en ningún sitio.
 *
 * La tarjeta entera abre la ficha del término, así que corregir una errata no
 * obliga a borrarlo y volver a escribirlo.
 *
 * @param {object} entrada
 * @param {boolean} enElSegmento Si la palabra está en el segmento de ahora.
 * @returns {HTMLElement}
 */
function tarjetaDeTermino(entrada, enElSegmento) {
    const t = translations[state.currentLanguage] || {};
    const indice = state.glossary.indexOf(entrada);

    const tarjeta = document.createElement('div');
    tarjeta.className = `glosario-tarjeta${enElSegmento ? ' glosario-tarjeta-coincidencia' : ''}`;
    tarjeta.dataset.glossaryIndex = String(indice);
    tarjeta.tabIndex = 0;
    tarjeta.title = t['edit_term_hint'] || '';

    const categoria = entrada.srcPartOfSpeech
        ? `<span class="glosario-categoria">${escaparHtml(
              t[`pos_${entrada.srcPartOfSpeech}`] || entrada.srcPartOfSpeech,
          )}</span>`
        : '';
    // La marca de que el término tiene ficha: sin abrirlo no había manera de
    // saber cuáles están documentados y cuáles son un par de palabras.
    const marca = tieneFicha(entrada)
        ? '<span class="glosario-ficha" aria-hidden="true"></span>'
        : '';
    const linea = (clase, valor) =>
        valor ? `<p class="${clase}">${escaparHtml(valor)}</p>` : '';

    tarjeta.innerHTML = `
        <div class="glosario-tarjeta-cabecera">
            <p class="glosario-tarjeta-origen">${escaparHtml(entrada.srcTerm || '')}${categoria}${marca}</p>
            <span class="glosario-tarjeta-botones">
                <button type="button" class="glosario-insertar" title="${escaparHtml(t['term_card_insert_hint'] || '')}">${escaparHtml(t['glossary_insert_term'] || '')}</button>
                <button type="button" class="glossary-delete-btn" data-glossary-index="${indice}" title="${escaparHtml(t['delete_button'] || '')}" aria-label="${escaparHtml(t['delete_button'] || '')}">&times;</button>
            </span>
        </div>
        <p class="glosario-tarjeta-destino">${escaparHtml(entrada.tgtTerm || '')}</p>
        ${linea('glosario-tarjeta-definicion', entrada.definition)}
        ${linea('glosario-tarjeta-notas', entrada.notes)}`;

    const abrir = () => abrirFichaDeTermino(Number(tarjeta.dataset.glossaryIndex));
    tarjeta.addEventListener('click', abrir);
    tarjeta.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault();
            abrir();
        }
    });

    const insertar = tarjeta.querySelector('.glosario-insertar');
    // Pulsar un botón saca el cursor del segmento antes de que llegue el clic, y
    // sin cursor no hay dónde insertar. Cancelando el mousedown, el foco no se
    // mueve. (Y el clic no puede subir hasta la tarjeta: abriría la ficha.)
    insertar.addEventListener('mousedown', (evento) => evento.preventDefault());
    insertar.addEventListener('click', (evento) => {
        evento.stopPropagation();
        alInsertar(entrada.tgtTerm || '');
    });

    // El botón de borrar corta el clic para no abrir la ficha de algo que se
    // está quitando.
    tarjeta.querySelector('.glossary-delete-btn').addEventListener('click', (evento) => {
        evento.stopPropagation();
        deleteTerm(Number(evento.currentTarget.dataset.glossaryIndex));
    });

    return tarjeta;
}

/** Un rótulo que separa las coincidencias del resto del glosario. */
function grupoDeTarjetas(texto) {
    const rotulo = document.createElement('p');
    rotulo.className = 'glosario-grupo';
    rotulo.textContent = texto;
    return rotulo;
}

function renderGlossary() {
    if (!glosarioLista) {
        console.warn('glosarioLista element not found. Cannot render glossary.');
        return;
    }
    avisarSiEstanVacios();

    const t = translations[state.currentLanguage] || {};
    const buscado = buscarPaneles ? buscarPaneles.value.trim() : '';
    glosarioLista.innerHTML = '';

    // Buscando se enseña lo que responde a la búsqueda, y nada más. Sin buscar,
    // primero lo que está en el segmento que se tiene delante —que es lo que
    // hace falta ahora mismo— y debajo el resto del glosario, por si se quiere
    // repasar o corregir algo.
    const visibles = buscado
        ? terminosQueResponden(state.glossary, buscado)
        : state.glossary;

    const enElSegmento = [];
    const losDemas = [];
    for (const entrada of visibles) {
        if (entrada.srcTerm && state.termsFoundInActiveSegment.has(entrada.srcTerm)) {
            enElSegmento.push(entrada);
        } else {
            losDemas.push(entrada);
        }
    }
    // Las coincidencias, de la expresión más larga a la más corta: la de varias
    // palabras dice más que la palabra suelta.
    enElSegmento.sort((a, b) => (b.srcTerm?.length || 0) - (a.srcTerm?.length || 0));
    losDemas.sort((a, b) => (a.srcTerm || '').localeCompare(b.srcTerm || ''));

    state.currentGlossaryLatestResults = [...enElSegmento, ...losDemas];

    // Los rótulos solo tienen sentido si hay dos grupos que separar.
    const hayDosGrupos = enElSegmento.length > 0 && losDemas.length > 0;

    if (enElSegmento.length > 0 && hayDosGrupos) {
        glosarioLista.appendChild(grupoDeTarjetas(t['glossary_in_segment'] || ''));
    }
    enElSegmento.forEach((entrada) => glosarioLista.appendChild(tarjetaDeTermino(entrada, true)));

    if (hayDosGrupos) {
        glosarioLista.appendChild(grupoDeTarjetas(t['glossary_all_terms'] || ''));
    }
    losDemas.forEach((entrada) => glosarioLista.appendChild(tarjetaDeTermino(entrada, false)));

    // La lista solo sale cuando tiene algo que enseñar, igual que la de la
    // memoria: con el glosario vacío ya lo explica el aviso de arriba.
    document
        .getElementById('glosarioResultados')
        ?.classList.toggle('hidden', visibles.length === 0);
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
    alInsertarDesdeElGlosario,
    downloadTBX,
    loadTBX,
    processTBXContent,
    renderGlossary,
    resetGlossary,
    showGlossaryEditorSection,
};
