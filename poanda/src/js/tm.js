import { calculateSimilarity, countWords } from './core/text.js';
import { generateTMX } from './core/tmx.js';
import { hideLoadingOverlay, showLoadingOverlay } from './dialogs.js';
import {
    tmInternalMessage,
    tmNoMatchFoundMessage,
    buscarPaneles,
    tmResultadosLista,
} from './dom.js';
import { escaparHtml } from './core/xml.js';
import { bandaDeCoincidencia, coincidenciasQueValen } from './core/tm-coincidencias.js';
import { mismoIdioma } from './core/idiomas.js';
import { pintarParDelProyecto } from './idiomas-proyecto.js';
import { avisarSiEstanVacios } from './paneles.js';
import { getCurrentFocusedIndex } from './editor.js';
import { state } from './state.js';
import { translations } from './translations.js';

function showTMInternalMessage(msg, isError = false) {
    if (tmInternalMessage) {
        tmInternalMessage.textContent = msg;
        tmInternalMessage.classList.remove(
            'hidden',
            'bg-red-100',
            'text-red-800',
            'border-red-500',
            'bg-blue-100',
            'text-blue-800',
            'border-blue-500',
        );
        if (isError) {
            tmInternalMessage.classList.add('bg-red-100', 'text-red-800', 'border-red-500');
        } else {
            tmInternalMessage.classList.add('bg-blue-100', 'text-blue-800', 'border-blue-500');
        }
        tmInternalMessage.classList.remove('hidden');
    } else {
        console.warn('tmInternalMessage element not found.');
    }
}

function hideTMInternalMessage() {
    if (tmInternalMessage) {
        tmInternalMessage.classList.add('hidden');
        tmInternalMessage.textContent = '';
    }
}

function resetTM() {
    state.translationMemory = [];
    renderTMSearchResults([]);
    hideTMInternalMessage();
    showTMEditorSection();
}

/**
 * Deja a la vista el par de idiomas del proyecto y busca.
 *
 * La memoria ya no pregunta idiomas: los toma del proyecto, igual que el
 * glosario. Eran el mismo dato escrito en dos sitios que se podían contradecir.
 */
function showTMEditorSection() {
    pintarParDelProyecto('memoriaParIdiomas');
    avisarSiEstanVacios();
    tmSearch();
}

function processTMXContent(content) {
    showLoadingOverlay(translations[state.currentLanguage]['loading_file']);
    hideTMInternalMessage();

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'application/xml');

        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            const errorText = xmlDoc.getElementsByTagName('parsererror')[0].textContent;
            throw new Error('Invalid XML/TMX format: ' + errorText);
        }

        if (xmlDoc.getElementsByTagName('termEntry').length > 0) {
            showTMInternalMessage(
                translations[state.currentLanguage]['tmx_file_expected_tbx_found'],
                true,
            );
            throw new Error('Attempted to load TBX into Translation Memory.');
        }

        const tuElements = xmlDoc.getElementsByTagName('tu');
        let newTM = [];

        for (let tu of tuElements) {
            const tuvElements = tu.getElementsByTagName('tuv');
            if (tuvElements.length >= 2) {
                const srcTuv = tuvElements[0];
                const tgtTuv = tuvElements[1];
                const srcLang = srcTuv.getAttribute('xml:lang');
                const tgtLang = tgtTuv.getAttribute('xml:lang');
                const srcSeg = srcTuv.getElementsByTagName('seg')[0]?.textContent || '';
                const tgtSeg = tgtTuv.getElementsByTagName('seg')[0]?.textContent || '';

                newTM.push({
                    srcLang: srcLang,
                    srcText: srcSeg,
                    tgtLang: tgtLang,
                    tgtText: tgtSeg,
                    srcWordCount: countWords(srcSeg),
                    tgtWordCount: countWords(tgtSeg),
                });
            }
        }

        state.translationMemory = newTM;
        avisarSiEstanVacios();

        showTMInternalMessage(
            `TMX loaded with ${state.translationMemory.length} translation units.`,
        );
        showTMEditorSection();
        tmSearch();
    } catch (error) {
        console.error('Error loading TMX file:', error);
        if (!error.message.includes('Attempted to load TBX')) {
            showTMInternalMessage(
                translations[state.currentLanguage]['error_loading_tmx_file'],
                true,
            );
        }
        resetTM();
    } finally {
        hideLoadingOverlay();
    }
}

function downloadTMX() {
    const tmxContent = generateTMX();
    if (!tmxContent) {
        showTMInternalMessage(
            translations[state.currentLanguage]['cannot_download_empty_tm'],
            true,
        );
        return;
    }

    showLoadingOverlay(translations[state.currentLanguage]['saving_file']);
    try {
        const blob = new Blob([tmxContent], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'translation_memory.tmx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showTMInternalMessage(translations[state.currentLanguage]['file_saved_successfully']);
    } catch (error) {
        showTMInternalMessage(
            `${translations[state.currentLanguage]['error_saving_file']} ${error.message}`,
            true,
        );
        console.error('Error downloading TMX:', error);
    } finally {
        hideLoadingOverlay();
    }
}

function addOrUpdateTMEntry(original, translation) {
    if (!original || !translation) return;
    if (!state.sourceLang || !state.targetLang) {
        console.warn('El proyecto no tiene par de idiomas; no se toca la memoria.');
        return;
    }

    const existingIndex = state.translationMemory.findIndex(
        (entry) =>
            entry.srcText === original &&
            mismoIdioma(entry.srcLang, state.sourceLang) &&
            mismoIdioma(entry.tgtLang, state.targetLang),
    );

    if (existingIndex !== -1) {
        state.translationMemory[existingIndex].tgtText = translation;
        state.translationMemory[existingIndex].tgtWordCount = countWords(translation);
    } else {
        state.translationMemory.push({
            srcLang: state.sourceLang,
            srcText: original,
            tgtLang: state.targetLang,
            tgtText: translation,
            srcWordCount: countWords(original),
            tgtWordCount: countWords(translation),
        });
    }
    avisarSiEstanVacios();
    tmSearch();
}

function findBestTMMatch(sourceSegmentText) {
    if (
        state.translationMemory.length === 0 ||
        !sourceSegmentText.trim() ||
        !state.sourceLang ||
        !state.targetLang
    ) {
        return null;
    }

    let bestMatch = null;
    let highestScore = 0;
    const MIN_FUZZY_THRESHOLD = 70;

    state.translationMemory.forEach((entry) => {
        // Se compara por lengua y no por etiqueta entera: una memoria exportada
        // de otra herramienta viene marcada "en-US" y el proyecto puede estar
        // en "en". Exigir que coincidan letra por letra dejaría sin usar la
        // memoria entera, y nadie entendería por qué.
        if (
            mismoIdioma(entry.srcLang, state.sourceLang) &&
            mismoIdioma(entry.tgtLang, state.targetLang) &&
            entry.srcText.trim()
        ) {
            const score = calculateSimilarity(sourceSegmentText, entry.srcText);
            if (score >= MIN_FUZZY_THRESHOLD && score > highestScore) {
                highestScore = score;
                bestMatch = { ...entry, score: score.toFixed(0) };
            }
        }
    });

    return bestMatch;
}

function tmSearch() {
    const query = buscarPaneles ? buscarPaneles.value.toLowerCase().trim() : '';
    let resultsToRender = [];

    const currentFocused = getCurrentFocusedIndex();
    let activeSegmentOriginalText = null;
    if (
        currentFocused &&
        state.poEntries[currentFocused.entryIndex] &&
        state.poEntries[currentFocused.entryIndex].sentenceSegments &&
        state.poEntries[currentFocused.entryIndex].sentenceSegments[currentFocused.segmentIndex]
    ) {
        activeSegmentOriginalText =
            state.poEntries[currentFocused.entryIndex].sentenceSegments[currentFocused.segmentIndex]
                .original;
    }

    state.tmBestMatchForActiveSegment = null;
    if (activeSegmentOriginalText) {
        state.tmBestMatchForActiveSegment = findBestTMMatch(activeSegmentOriginalText);
    }

    if (
        state.tmBestMatchForActiveSegment &&
        (query === '' || state.tmBestMatchForActiveSegment.srcText.toLowerCase().includes(query))
    ) {
        resultsToRender.push({ ...state.tmBestMatchForActiveSegment, isBestMatch: true });
    }

    const filteredTM = state.translationMemory.filter((entry) => {
        if (
            state.tmBestMatchForActiveSegment &&
            entry.srcText === state.tmBestMatchForActiveSegment.srcText &&
            entry.tgtText === state.tmBestMatchForActiveSegment.tgtText
        ) {
            return false;
        }
        if (query) {
            return (
                (entry.srcText && entry.srcText.toLowerCase().includes(query)) ||
                (entry.tgtText && entry.tgtText.toLowerCase().includes(query))
            );
        }
        return true;
    });

    const puntuadas = filteredTM.map((entry) => {
        let score = 0;
        if (query) {
            score = calculateSimilarity(query, entry.srcText);
        } else if (activeSegmentOriginalText) {
            score = calculateSimilarity(activeSegmentOriginalText, entry.srcText);
        }
        return { ...entry, score: Number(score.toFixed(0)) };
    });

    // Buscando, vale cualquier unidad que contenga lo buscado: el parecido con
    // la frase entera no dice nada cuando lo que se busca es una palabra.
    // Sin buscar, se comparan con el segmento en el que se está, y ahí sí hay
    // que poner un mínimo: la memoria devuelve un parecido para CADA unidad que
    // tiene dentro, así que sin filtro salían coincidencias del 12 % —dos
    // frases sin nada en común— empujando hacia abajo la que servía.
    const utiles = query
        ? puntuadas.sort((a, b) => a.srcText.localeCompare(b.srcText))
        : coincidenciasQueValen(puntuadas);

    resultsToRender.push(...utiles);
    state.currentTMLatestSearchResults = resultsToRender;
    renderTMSearchResults(resultsToRender, activeSegmentOriginalText);
}

/**
 * Marca en el original de la memoria lo que cambia respecto al segmento actual.
 *
 * Lo que se ve tachado sobra en el segmento de ahora; lo subrayado falta. Es lo
 * que hay que mirar para decidir si una coincidencia sirve tal cual o hay que
 * retocarla, y por eso va en el original y no en la traducción.
 *
 * @param {string} original El de la memoria.
 * @param {string} actual El del segmento en el que se está.
 * @returns {string} HTML ya escapado.
 */
function marcarDiferencias(original, actual) {
    if (!actual || typeof Diff === 'undefined') return escaparHtml(original);

    return Diff.diffWords(original, actual)
        .map((trozo) => {
            const texto = escaparHtml(trozo.value);
            if (trozo.added) return `<ins class="tm-diff-mas">${texto}</ins>`;
            if (trozo.removed) return `<del class="tm-diff-menos">${texto}</del>`;
            return texto;
        })
        .join('');
}

/**
 * Resalta lo buscado dentro de un texto.
 *
 * Cuando se busca en la memoria, un diff no tiene sentido: no se compara con
 * ningún segmento, se busca una palabra. Lo que ayuda es ver dónde está.
 *
 * @param {string} texto
 * @param {string} buscado
 * @returns {string} HTML ya escapado.
 */
function resaltarLoBuscado(texto, buscado) {
    const cadena = String(texto ?? '');
    const aguja = String(buscado ?? '').trim();
    if (!aguja) return escaparHtml(cadena);

    const busca = new RegExp(aguja.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let html = '';
    let ultimo = 0;
    let encontrado;
    while ((encontrado = busca.exec(cadena)) !== null) {
        html += escaparHtml(cadena.slice(ultimo, encontrado.index));
        html += `<mark class="tm-encontrado">${escaparHtml(encontrado[0])}</mark>`;
        ultimo = encontrado.index + encontrado[0].length;
        if (encontrado[0] === '') break;
    }
    return html + escaparHtml(cadena.slice(ultimo));
}

/**
 * Una tarjeta de coincidencia.
 *
 * La forma viene de Locversia, que resuelve el mismo problema en el mismo
 * sitio: una columna estrecha. Arriba la insignia con el porcentaje y el botón
 * de insertar; debajo el original a todo lo ancho, y debajo la traducción. La
 * tabla de tres columnas que había antes dejaba cada celda en unos cien
 * píxeles, y ahí no cabe una frase: salía cortada cada dos palabras, y el diff
 * entre ellas era confeti.
 *
 * @param {Object} entrada Unidad de la memoria, con su puntuación.
 * @param {string} original Texto del segmento en el que se está.
 * @param {string} buscado Lo que se haya escrito en el buscador.
 * @returns {HTMLElement}
 */
function tarjetaDeCoincidencia(entrada, original, buscado) {
    const t = translations[state.currentLanguage];
    const puntuacion = Math.round(Number(entrada.score) || 0);
    // Buscando, el porcentaje no significa nada: se compara lo escrito en el
    // buscador con la unidad entera, así que buscar "archivo" en una frase
    // larga da un 12 % que parece una coincidencia malísima cuando en realidad
    // es justo lo que se pedía. En ese modo la insignia dice "concordancia".
    const banda = buscado ? 'busqueda' : bandaDeCoincidencia(puntuacion);
    const insignia = buscado ? escaparHtml(t['tm_insignia_busqueda'] || '') : `${puntuacion}%`;

    const tarjeta = document.createElement('div');
    tarjeta.className = `tm-tarjeta tm-banda-${banda}`;
    if (entrada.isBestMatch) tarjeta.classList.add('tm-tarjeta-mejor');

    // Buscando se resalta lo buscado; sin buscar, se marca lo que cambia
    // respecto al segmento en el que se está.
    const origenHtml = buscado
        ? resaltarLoBuscado(entrada.srcText, buscado)
        : marcarDiferencias(entrada.srcText, original);

    tarjeta.innerHTML = `
        <div class="tm-tarjeta-cabecera">
            <span class="tm-insignia" title="${escaparHtml(t[`tm_banda_${banda}`] || '')}">${insignia}</span>
            <button type="button" class="tm-insertar">${escaparHtml(t['tm_insert_match'] || '')}</button>
        </div>
        <p class="tm-tarjeta-origen">${origenHtml}</p>
        <p class="tm-tarjeta-destino">${escaparHtml(entrada.tgtText || '')}</p>`;

    const boton = tarjeta.querySelector('.tm-insertar');
    // Pulsar un botón saca el cursor del segmento antes de que llegue el clic, y
    // sin cursor no hay dónde insertar: con el ratón el botón no hacía nada.
    // Cancelando el mousedown, el foco no se mueve y el texto va a su sitio.
    boton.addEventListener('mousedown', (evento) => evento.preventDefault());
    boton.addEventListener('click', () => {
        insertarCoincidencia(entrada.tgtText);
    });

    return tarjeta;
}

/**
 * Mete la traducción de una coincidencia en el segmento en el que se está.
 *
 * @param {string} traduccion
 */
function insertarCoincidencia(traduccion) {
    const donde = getCurrentFocusedIndex() || state.lastFocusedSegment;
    if (!donde) return;

    const campo = document.getElementById(`msgstr-${donde.entryIndex}-${donde.segmentIndex}`);
    if (!campo || campo.readOnly) return;

    campo.value = traduccion;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.focus();
}

function renderTMSearchResults(results, activeSegmentOriginalText) {
    if (!tmResultadosLista) {
        console.warn('tmResultadosLista element not found. Cannot render TM search results.');
        return;
    }
    tmResultadosLista.innerHTML = '';

    // La lista solo sale cuando tiene algo que enseñar: o hay coincidencias, o
    // se ha escrito algo en el buscador y merece decirse que no hay ninguna.
    const buscando = Boolean(buscarPaneles?.value.trim());
    document
        .getElementById('tmResultados')
        ?.classList.toggle('hidden', results.length === 0 && !buscando);

    if (results.length === 0) {
        // Con la memoria vacía, "no se encontraron coincidencias" no dice nada
        // que no diga ya el aviso de arriba, y dos mensajes seguidos para el
        // mismo hecho se leen como si fueran dos problemas distintos.
        const vacia = (state.translationMemory || []).length === 0;
        if (tmNoMatchFoundMessage) {
            tmNoMatchFoundMessage.classList.toggle('hidden', vacia || !buscando);
        }
        return;
    }

    if (tmNoMatchFoundMessage) tmNoMatchFoundMessage.classList.add('hidden');
    hideTMInternalMessage();

    const buscado = buscando ? buscarPaneles.value.trim() : '';
    results.forEach((entrada) => {
        tmResultadosLista.appendChild(
            tarjetaDeCoincidencia(entrada, activeSegmentOriginalText, buscado),
        );
    });
}

export {
    addOrUpdateTMEntry,
    downloadTMX,
    findBestTMMatch,
    processTMXContent,
    resetTM,
    showTMEditorSection,
    showTMInternalMessage,
    tmSearch,
};
