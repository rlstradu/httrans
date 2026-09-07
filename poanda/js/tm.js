import { calculateSimilarity, countWords } from './core/text.js';
import { generateTMX } from './core/tmx.js';
import { hideLoadingOverlay, showLoadingOverlay } from './dialogs.js';
import {
    displayTmSrcLang,
    displayTmTgtLang,
    tmConfigSrcLang,
    tmConfigTgtLang,
    tmEditorSection,
    tmInternalMessage,
    tmLanguageConfigSection,
    tmNoMatchFoundMessage,
    tmSearchInput,
    tmSearchResultsTableBody,
} from './dom.js';
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
    state.tmSourceLanguage = '';
    state.tmTargetLanguage = '';
    if (tmSearchInput) tmSearchInput.value = '';
    renderTMSearchResults([]);
    showTMLanguageConfigSection();
    showTMInternalMessage(translations[state.currentLanguage]['tm_initial_message']);
}

function showTMLanguageConfigSection() {
    if (tmLanguageConfigSection && tmEditorSection) {
        tmLanguageConfigSection.style.display = 'block';
        tmEditorSection.style.display = 'none';
        if (tmConfigSrcLang) tmConfigSrcLang.value = 'en-US';
        if (tmConfigTgtLang) tmConfigTgtLang.value = 'es-ES';
        hideTMInternalMessage();
    }
}

function showTMEditorSection() {
    if (tmLanguageConfigSection && tmEditorSection && displayTmSrcLang && displayTmTgtLang) {
        tmLanguageConfigSection.style.display = 'none';
        tmEditorSection.style.display = 'block';
        displayTmSrcLang.value = state.tmSourceLanguage;
        displayTmTgtLang.value = state.tmTargetLanguage;
        tmSearch();
        hideTMInternalMessage();
    }
}

function confirmTMLanguages() {
    const srcLang = tmConfigSrcLang ? tmConfigSrcLang.value.trim() : '';
    const tgtLang = tmConfigTgtLang ? tmConfigTgtLang.value.trim() : '';

    if (!srcLang || !tgtLang) {
        showTMInternalMessage(translations[state.currentLanguage]['lang_config_required'], true);
        return;
    }

    state.tmSourceLanguage = srcLang;
    state.tmTargetLanguage = tgtLang;

    showTMEditorSection();
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
        let detectedSrcLang = '';
        let detectedTgtLang = '';

        if (tuElements.length > 0) {
            const tuvElements = tuElements[0].getElementsByTagName('tuv');
            if (tuvElements.length >= 2) {
                detectedSrcLang = tuvElements[0].getAttribute('xml:lang');
                detectedTgtLang = tuvElements[1].getAttribute('xml:lang');
            }
        }

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
        state.tmSourceLanguage =
            detectedSrcLang || (tmConfigSrcLang ? tmConfigSrcLang.value : 'en-US');
        state.tmTargetLanguage =
            detectedTgtLang || (tmConfigTgtLang ? tmConfigTgtLang.value : 'es-ES');

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
    if (!state.tmSourceLanguage || !state.tmTargetLanguage) {
        console.warn('TM languages not configured. Skipping TM update.');
        return;
    }

    const existingIndex = state.translationMemory.findIndex(
        (entry) =>
            entry.srcText === original &&
            entry.srcLang === state.tmSourceLanguage &&
            entry.tgtLang === state.tmTargetLanguage,
    );

    if (existingIndex !== -1) {
        state.translationMemory[existingIndex].tgtText = translation;
        state.translationMemory[existingIndex].tgtWordCount = countWords(translation);
    } else {
        state.translationMemory.push({
            srcLang: state.tmSourceLanguage,
            srcText: original,
            tgtLang: state.tmTargetLanguage,
            tgtText: translation,
            srcWordCount: countWords(original),
            tgtWordCount: countWords(translation),
        });
    }
    tmSearch();
}

function findBestTMMatch(sourceSegmentText) {
    if (
        state.translationMemory.length === 0 ||
        !sourceSegmentText.trim() ||
        !state.tmSourceLanguage ||
        !state.tmTargetLanguage
    ) {
        return null;
    }

    let bestMatch = null;
    let highestScore = 0;
    const MIN_FUZZY_THRESHOLD = 70;

    state.translationMemory.forEach((entry) => {
        if (
            entry.srcLang === state.tmSourceLanguage &&
            entry.tgtLang === state.tmTargetLanguage &&
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
    const query = tmSearchInput ? tmSearchInput.value.toLowerCase().trim() : '';
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

    filteredTM.forEach((entry) => {
        let score = 0;
        if (query) {
            score = calculateSimilarity(query, entry.srcText);
        } else if (activeSegmentOriginalText) {
            score = calculateSimilarity(activeSegmentOriginalText, entry.srcText);
        }
        resultsToRender.push({ ...entry, score: score.toFixed(0) });
    });

    resultsToRender.sort((a, b) => {
        if (a.isBestMatch) return -1;
        if (b.isBestMatch) return 1;

        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return a.srcText.localeCompare(b.srcText);
    });

    state.currentTMLatestSearchResults = resultsToRender;
    renderTMSearchResults(resultsToRender, activeSegmentOriginalText);
}

function renderTMSearchResults(results, activeSegmentOriginalText) {
    if (!tmSearchResultsTableBody) {
        console.warn(
            'tmSearchResultsTableBody element not found. Cannot render TM search results.',
        );
        return;
    }
    tmSearchResultsTableBody.innerHTML = '';
    if (results.length === 0) {
        if (tmNoMatchFoundMessage) tmNoMatchFoundMessage.classList.remove('hidden');
        if (tmInternalMessage && tmInternalMessage.classList.contains('hidden')) {
            if (tmNoMatchFoundMessage) tmNoMatchFoundMessage.classList.remove('hidden');
        }
        return;
    } else {
        if (tmNoMatchFoundMessage) tmNoMatchFoundMessage.classList.add('hidden');
    }
    hideTMInternalMessage();

    results.forEach((entry) => {
        const row = document.createElement('tr');
        if (entry.isBestMatch) {
            row.classList.add('tm-best-match-highlight');
        }

        let originalCellHtml = '';
        if (activeSegmentOriginalText) {
            const differences = Diff.diffChars(entry.srcText, activeSegmentOriginalText);
            originalCellHtml = differences
                .map((part) => {
                    const className = part.added
                        ? 'diff-added'
                        : part.removed
                          ? 'diff-removed'
                          : 'diff-common';
                    return `<span class="${className}">${part.value}</span>`;
                })
                .join('');
        } else {
            originalCellHtml = entry.srcText;
        }

        row.innerHTML = `
                    <td>${entry.score}%</td>
                    <td><pre class="whitespace-pre-wrap">${originalCellHtml}</pre></td>
                    <td><pre class="whitespace-pre-wrap">${entry.tgtText}</pre></td>
                `;
        row.addEventListener('click', () => {
            const currentFocused = getCurrentFocusedIndex();
            if (currentFocused) {
                const targetTextarea = document.getElementById(
                    `msgstr-${currentFocused.entryIndex}-${currentFocused.segmentIndex}`,
                );
                if (targetTextarea && !targetTextarea.readOnly) {
                    targetTextarea.value = entry.tgtText;
                    const event = new Event('input', { bubbles: true });
                    targetTextarea.dispatchEvent(event);
                }
            }
        });
        tmSearchResultsTableBody.appendChild(row);
    });
}

export {
    addOrUpdateTMEntry,
    confirmTMLanguages,
    downloadTMX,
    findBestTMMatch,
    processTMXContent,
    resetTM,
    showTMEditorSection,
    showTMInternalMessage,
    showTMLanguageConfigSection,
    tmSearch,
};
