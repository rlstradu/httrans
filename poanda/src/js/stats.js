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
    segmentsProgress.textContent = `${translatedSegments} / ${totalSegments} segments (${percentage}%)`;
    wordsTranslated.textContent = `${totalWordsTranslated}`;
    wordsTotal.textContent = `${totalWordsOriginal}`;

    // El cálculo correcto para las palabras restantes
    wordsRemaining.textContent = `${totalWordsOriginal - originalWordsInTranslatedSegments}`;
    // --- CORRECCIÓN FINAL: Asegurar que los botones se activen tras cada cambio ---
    updateSaveButtonsState();
}

function updateUtilityButtonStates() {
    // El botón se enciende cuando la columna de consulta está a la vista, que
    // es su estado normal: apagado significa que se ha escondido a propósito.
    if (panelesBtn) {
        panelesBtn.classList.toggle(
            'utility-btn-active',
            !document.body.classList.contains('paneles-ocultos'),
        );
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
