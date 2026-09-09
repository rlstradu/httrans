import {
    aiSidebar,
    segmentsProgress,
    statsBtn,
    statsContainer,
    panelesBtn,
    wordsRemaining,
    wordsTotal,
    wordsTranslated,
} from './dom.js';
import { updateSaveButtonsState } from './files.js';
import { state } from './state.js';
import { translations } from './translations.js';

function updateStatsDisplay() {
    let totalSegments = 0;
    let translatedSegments = 0;
    let totalWordsOriginal = 0;
    let totalWordsTranslated = 0;
    let originalWordsInTranslatedSegments = 0; // Variable clave para el cálculo correcto

    state.poEntries.forEach((entry) => {
        if (entry.isHeader) return;

        if (entry.sentenceSegments) {
            entry.sentenceSegments.forEach((segment) => {
                totalSegments++;
                totalWordsOriginal += segment.wordCountOriginal;

                // Comprueba si el segmento está validado
                if (segment.isTranslated) {
                    translatedSegments++;
                    totalWordsTranslated += segment.wordCountTranslation;
                    // Acumula las palabras del ORIGINAL del segmento ya traducido
                    originalWordsInTranslatedSegments += segment.wordCountOriginal;
                }
            });
        }
    });

    const percentage =
        totalSegments > 0 ? ((translatedSegments / totalSegments) * 100).toFixed(0) : 0;
    // La palabra "segmentos" estaba escrita a mano en inglés, así que la barra
    // se quedaba a medio traducir con la interfaz en español.
    const unidad = translations[state.currentLanguage]?.stats_segments_unit || 'segments';
    segmentsProgress.textContent = `${translatedSegments} / ${totalSegments} ${unidad} (${percentage}%)`;
    wordsTranslated.textContent = `${totalWordsTranslated}`;
    wordsTotal.textContent = `${totalWordsOriginal}`;

    // El cálculo correcto para las palabras restantes
    wordsRemaining.textContent = `${totalWordsOriginal - originalWordsInTranslatedSegments}`;
    // --- CORRECCIÓN FINAL: Asegurar que los botones se activen tras cada cambio ---
    updateSaveButtonsState();
}

function updateUtilityButtonStates() {
    // El botón se enciende cuando la columna de consulta está a la vista, que
    // es su estado normal con un archivo abierto: apagado significa que se ha
    // escondido a propósito, o que no hay proyecto. Sin proyecto no hay columna
    // —solo existe con 'con-proyecto'— y el botón se quedaba encendido después
    // de Nuevo proyecto, señalando algo que ya no estaba en la pantalla.
    if (panelesBtn) {
        const alaVista =
            document.body.classList.contains('con-proyecto') &&
            !document.body.classList.contains('paneles-ocultos');
        panelesBtn.classList.toggle('utility-btn-active', alaVista);
    }

    if (statsContainer.classList.contains('show')) {
        statsBtn.classList.add('utility-btn-active');
    } else {
        statsBtn.classList.remove('utility-btn-active');
    }
    if (aiSidebar && aiSidebar.classList.contains('show-sidebar')) {
        document.getElementById('aiBtn').classList.add('utility-btn-active');
    } else {
        document.getElementById('aiBtn')?.classList.remove('utility-btn-active');
    }
}

export { updateStatsDisplay, updateUtilityButtonStates };
