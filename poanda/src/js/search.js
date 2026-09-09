import { countWords } from './core/text.js';
import { showMessage } from './dialogs.js';
import {
    caseSensitiveCheckbox,
    findInput,
    regexCheckbox,
    replaceInput,
    searchNextBtn,
    searchPrevBtn,
    searchResultCounter,
} from './dom.js';
import { navigateToTranslation, pushToUndoStack, renderTranslations } from './editor.js';
import { state } from './state.js';
import { updateStatsDisplay } from './stats.js';
import { translations } from './translations.js';

function updateSearchCounter() {
    const total = state.searchResults.length;
    const current = total > 0 ? state.currentSearchIndex + 1 : 0;
    searchResultCounter.textContent = `${current} / ${total}`;

    searchPrevBtn.disabled = total === 0;
    searchNextBtn.disabled = total === 0;
}

function navigateToSearchResult(direction) {
    if (state.searchResults.length === 0) return;

    // Remove highlight from the current result
    if (state.currentSearchIndex >= 0 && state.searchResults[state.currentSearchIndex]) {
        state.searchResults[state.currentSearchIndex].classList.remove('current-search-highlight');
        state.searchResults[state.currentSearchIndex].classList.add('search-highlight');
    }

    // Update index
    state.currentSearchIndex += direction;

    // Loop around
    if (state.currentSearchIndex >= state.searchResults.length) {
        state.currentSearchIndex = 0;
    }
    if (state.currentSearchIndex < 0) {
        state.currentSearchIndex = state.searchResults.length - 1;
    }

    // Highlight the new current result
    const currentResult = state.searchResults[state.currentSearchIndex];
    if (currentResult) {
        currentResult.classList.remove('search-highlight');
        currentResult.classList.add('current-search-highlight');
        currentResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    updateSearchCounter();
}

function findAndNavigate(forward = true) {
    const query = findInput.value;
    if (!query) {
        showMessage(translations[state.currentLanguage]['no_find_query']);
        return;
    }

    state.findState.query = query;
    state.findState.caseSensitive = caseSensitiveCheckbox.checked;
    state.findState.useRegex = regexCheckbox.checked;

    let regex;
    try {
        regex = state.findState.useRegex
            ? new RegExp(state.findState.query, state.findState.caseSensitive ? '' : 'i')
            : null;
    } catch (e) {
        showMessage(translations[state.currentLanguage]['regex_invalida'].replace('{detalle}', e.message));
        return;
    }

    let startEntryIndex = 0;
    let startSegmentIndex = 0;
    let startMatchIndex = 0;

    if (state.findState.lastFound) {
        startEntryIndex = state.findState.lastFound.entryIndex;
        startSegmentIndex = state.findState.lastFound.segmentIndex;
        startMatchIndex = forward
            ? state.findState.lastFound.matchEnd
            : state.findState.lastFound.matchStart - 1;
    } else {
        if (!forward) {
            startEntryIndex = state.poEntries.length - 1;
            if (
                state.poEntries[startEntryIndex] &&
                state.poEntries[startEntryIndex].sentenceSegments
            ) {
                startSegmentIndex = state.poEntries[startEntryIndex].sentenceSegments.length - 1;
            } else {
                startSegmentIndex = 0;
            }
            startMatchIndex = Infinity;
        }
    }

    let found = false;
    let currentEntryIndex = startEntryIndex;
    let currentSegmentIndex = startSegmentIndex;
    const totalEntries = state.poEntries.length;

    for (let i = 0; i < totalEntries; i++) {
        const entry = state.poEntries[currentEntryIndex];
        if (!entry || entry.isHeader || !entry.sentenceSegments) {
            currentEntryIndex =
                (currentEntryIndex + (forward ? 1 : -1) + totalEntries) % totalEntries;
            currentSegmentIndex = forward
                ? 0
                : entry && entry.sentenceSegments
                  ? entry.sentenceSegments.length - 1
                  : 0;
            continue;
        }

        const totalSegments = entry.sentenceSegments.length;
        let segmentLoopStart = forward ? 0 : totalSegments - 1;
        let segmentLoopEnd = forward ? totalSegments : -1;
        let segmentLoopStep = forward ? 1 : -1;

        if (currentEntryIndex === startEntryIndex) {
            segmentLoopStart = startSegmentIndex;
        }

        for (
            let j = segmentLoopStart;
            forward ? j < segmentLoopEnd : j >= segmentLoopEnd;
            j += segmentLoopStep
        ) {
            const segment = entry.sentenceSegments[j];
            const text = segment.translation;
            let match;

            if (state.findState.useRegex) {
                regex.lastIndex = 0;
                if (forward) {
                    let searchFrom =
                        currentEntryIndex === startEntryIndex && j === startSegmentIndex
                            ? startMatchIndex
                            : 0;
                    const subText = text.substring(searchFrom);
                    match = regex.exec(subText);
                    if (match) {
                        match.index += searchFrom;
                    }
                } else {
                    let allMatches = [];
                    let tempRegex = new RegExp(
                        regex.source,
                        regex.flags.includes('g') ? regex.flags : regex.flags + 'g',
                    );
                    let tempMatch;
                    while ((tempMatch = tempRegex.exec(text)) !== null) {
                        allMatches.push(tempMatch);
                    }
                    let searchUntil =
                        currentEntryIndex === startEntryIndex && j === startSegmentIndex
                            ? startMatchIndex
                            : text.length;
                    match = allMatches.reverse().find((m) => m.index < searchUntil);
                }
            } else {
                const searchText = state.findState.caseSensitive ? text : text.toLowerCase();
                const queryLower = state.findState.caseSensitive
                    ? state.findState.query
                    : state.findState.query.toLowerCase();

                if (forward) {
                    let searchFrom =
                        currentEntryIndex === startEntryIndex && j === startSegmentIndex
                            ? startMatchIndex
                            : 0;
                    const foundIndex = searchText.indexOf(queryLower, searchFrom);
                    if (foundIndex !== -1) {
                        match = {
                            index: foundIndex,
                            0: text.substring(foundIndex, foundIndex + queryLower.length),
                        };
                    }
                } else {
                    let searchUntil =
                        currentEntryIndex === startEntryIndex && j === startSegmentIndex
                            ? startMatchIndex
                            : text.length;
                    const foundIndex = searchText.lastIndexOf(queryLower, searchUntil);
                    if (foundIndex !== -1) {
                        match = {
                            index: foundIndex,
                            0: text.substring(foundIndex, foundIndex + queryLower.length),
                        };
                    }
                }
            }

            if (match) {
                state.findState.lastFound = {
                    entryIndex: currentEntryIndex,
                    segmentIndex: j,
                    matchStart: match.index,
                    matchEnd: match.index + match[0].length,
                };
                navigateToTranslation(currentEntryIndex, j);
                const targetTextarea = document.getElementById(`msgstr-${currentEntryIndex}-${j}`);
                if (targetTextarea) {
                    targetTextarea.setSelectionRange(
                        state.findState.lastFound.matchStart,
                        state.findState.lastFound.matchEnd,
                    );
                }
                found = true;
                return;
            }
        }
        if (found) break;

        currentEntryIndex = (currentEntryIndex + (forward ? 1 : -1) + totalEntries) % totalEntries;
        currentSegmentIndex = forward
            ? 0
            : state.poEntries[currentEntryIndex].sentenceSegments
              ? state.poEntries[currentEntryIndex].sentenceSegments.length - 1
              : 0;
    }

    if (!found) {
        showMessage(translations[state.currentLanguage]['no_match_found']);
        state.findState.lastFound = null;
    }
}

function replaceCurrentMatch() {
    if (!state.findState.lastFound || !state.findState.query) {
        showMessage(translations[state.currentLanguage]['no_match_found']);
        return;
    }

    const { entryIndex, segmentIndex, matchStart, matchEnd } = state.findState.lastFound;
    const segment = state.poEntries[entryIndex].sentenceSegments[segmentIndex];
    let originalText = segment.translation;
    let replacedText;

    if (state.findState.useRegex) {
        const regex = new RegExp(state.findState.query, state.findState.caseSensitive ? '' : 'i');
        replacedText =
            originalText.substring(0, matchStart) +
            originalText.substring(matchStart, matchEnd).replace(regex, state.findState.replace) +
            originalText.substring(Math.min(matchEnd, originalText.length));
    } else {
        replacedText =
            originalText.substring(0, matchStart) +
            state.findState.replace +
            originalText.substring(Math.min(matchEnd, originalText.length));
    }

    segment.translation = replacedText;
    segment.wordCountTranslation = countWords(replacedText);
    segment.isTranslated = replacedText.trim() !== '';

    renderTranslations(state.poEntries);
    navigateToTranslation(entryIndex, segmentIndex);
    updateStatsDisplay();

    state.findState.lastFound = null;
}

function replaceAllMatches() {
    const query = findInput.value;
    const replaceWith = replaceInput.value;
    if (!query) {
        showMessage(translations[state.currentLanguage]['no_find_query']);
        return;
    }

    pushToUndoStack();
    let replacedCount = 0;
    let regex;
    try {
        regex = new RegExp(
            query,
            (caseSensitiveCheckbox.checked ? '' : 'i') + 'g' + (regexCheckbox.checked ? '' : ''),
        );
    } catch (e) {
        showMessage(translations[state.currentLanguage]['regex_invalida'].replace('{detalle}', e.message));
        return;
    }

    state.poEntries.forEach((entry) => {
        if (entry.isHeader) {
            return;
        }

        entry.sentenceSegments.forEach((segment) => {
            let originalTranslation = segment.translation;
            let newTranslation;

            if (regexCheckbox.checked) {
                newTranslation = originalTranslation.replace(regex, replaceWith);
            } else {
                const searchStr = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const nonRegexRegex = new RegExp(
                    searchStr,
                    (caseSensitiveCheckbox.checked ? '' : 'i') + 'g',
                );
                newTranslation = originalTranslation.replace(nonRegexRegex, replaceWith);
            }

            if (originalTranslation !== newTranslation) {
                segment.translation = newTranslation;
                segment.wordCountTranslation = countWords(newTranslation);
                segment.isTranslated = newTranslation.trim() !== '';
                replacedCount++;
            }
        });
    });

    renderTranslations(state.poEntries);
    showMessage(`${replacedCount} ${translations[state.currentLanguage]['replaced_all']}`);
    state.findState.lastFound = null;
    updateStatsDisplay();
}

export {
    findAndNavigate,
    navigateToSearchResult,
    replaceAllMatches,
    replaceCurrentMatch,
    updateSearchCounter,
};
