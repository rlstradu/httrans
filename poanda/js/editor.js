import { countWords } from './core/text.js';
import { showMessage } from './dialogs.js';
import {
    convertToMoButton,
    poSearchContainer,
    poSearchInput,
    savePoButton,
    searchInOriginalCheckbox,
    searchInTranslationCheckbox,
    statsContainer,
    translationsContainer,
    wordsTranslated,
} from './dom.js';
import { updateSaveButtonsState } from './files.js';
import { renderGlossary } from './glossary.js';
import { copyIconSVG } from './icons.js';
import { updateSearchCounter } from './search.js';
import { state } from './state.js';
import { updateStatsDisplay, updateUtilityButtonStates } from './stats.js';
import { addOrUpdateTMEntry, findBestTMMatch, tmSearch } from './tm.js';
import { translations } from './translations.js';

function pushToUndoStack() {
    // Guardamos un máximo de 15 estados para no saturar la memoria del navegador
    state.undoStack.push(JSON.parse(JSON.stringify(state.poEntries)));
    if (state.undoStack.length > 15) {
        state.undoStack.shift();
    }
}

function autoResizeTextarea(textarea, originalElement) {
    textarea.style.height = 'auto';
    if (textarea.value.trim() === '' && originalElement) {
        // If textarea is empty, set its height to match the original element's scroll height
        textarea.style.height = originalElement.scrollHeight + 'px';
    } else {
        // Otherwise, let it expand to its own content
        textarea.style.height = textarea.scrollHeight + 'px';
    }
}

function updateCharCount(textarea, originalLength, charCountSpan) {
    if (charCountSpan) {
        charCountSpan.textContent = `${translations[state.currentLanguage]['char_count_original']}${originalLength} ${translations[state.currentLanguage]['char_units']} | ${translations[state.currentLanguage]['char_count_translation']}${textarea.value.length} ${translations[state.currentLanguage]['char_units']}`;
    }
}

function setTranslationEditableState(entryIndex, segmentIndex, isEditable) {
    const msgstrTextarea = document.getElementById(`msgstr-${entryIndex}-${segmentIndex}`);
    const validateButton = document.getElementById(`validateBtn-${entryIndex}-${segmentIndex}`);
    const editButton = document.getElementById(`editBtn-${entryIndex}-${segmentIndex}`);
    const checkIcon = document.getElementById(`checkIcon-${entryIndex}-${segmentIndex}`);
    const translationUnit = document.getElementById(`translation-unit-${entryIndex}`); // Get the parent unit

    if (!msgstrTextarea || !validateButton || !editButton || !checkIcon || !translationUnit) {
        console.error(`Elements not found for index ${entryIndex}-${segmentIndex}`);
        return;
    }

    msgstrTextarea.readOnly = !isEditable;
    if (!isEditable) {
        msgstrTextarea.classList.add('bg-gray-200');
        translationUnit.classList.remove('translation-unit-active'); // Remove active highlight on validate

        // Update translation status and words when segment is validated
        const segment = state.poEntries[entryIndex].sentenceSegments[segmentIndex];
        segment.isTranslated = msgstrTextarea.value.trim() !== '';
        segment.wordCountTranslation = countWords(msgstrTextarea.value);
        updateStatsDisplay(); // Update stats
        addOrUpdateTMEntry(segment.original, segment.translation); // Add/Update TM
    } else {
        msgstrTextarea.classList.remove('bg-gray-200');
        translationUnit.classList.add('translation-unit-active'); // Add active highlight on edit/focus
    }

    validateButton.style.display = isEditable ? 'inline-block' : 'none';
    editButton.style.display = isEditable ? 'none' : 'inline-block';
    checkIcon.style.display = isEditable ? 'none' : 'inline-block';

    if (isEditable) {
        msgstrTextarea.focus();
        // Ensure cursor is at the end of the text
        msgstrTextarea.setSelectionRange(msgstrTextarea.value.length, msgstrTextarea.value.length);
    }
}

function performAutoPropagation(
    originalText,
    translationText,
    sourceEntryIndex,
    sourceSegmentIndex,
) {
    // Si la casilla no está marcada o el texto está vacío, no hacemos nada
    const checkbox = document.getElementById('autoPropagateCheckbox');
    if (!checkbox || !checkbox.checked || !translationText) return;

    let propagatedCount = 0;
    let snapshotTaken = false;

    state.poEntries.forEach((entry, eIdx) => {
        if (entry.isHeader) return;

        entry.sentenceSegments.forEach((segment, sIdx) => {
            // 1. No nos sobrescribimos a nosotros mismos
            if (eIdx === sourceEntryIndex && sIdx === sourceSegmentIndex) return;

            // 2. Verificamos si el original es idéntico
            if (segment.original === originalText) {
                // Guardar en el historial de Deshacer una sola vez antes de alterar segmentos
                if (!snapshotTaken) {
                    pushToUndoStack();
                    snapshotTaken = true;
                }

                // 3. Actualizamos los datos
                segment.translation = translationText;
                segment.wordCountTranslation = countWords(translationText);
                segment.isTranslated = true;
                propagatedCount++;

                // 4. Actualizamos lo visual (el textarea) si está renderizado en pantalla
                const textarea = document.getElementById(`msgstr-${eIdx}-${sIdx}`);
                if (textarea) {
                    textarea.value = translationText;
                    // Disparamos input para que se recalculen alturas y contadores de ese textarea
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));

                    // Efecto visual para saber que ha cambiado (flash amarillo rápido)
                    textarea.classList.add('bg-yellow-100');
                    setTimeout(() => textarea.classList.remove('bg-yellow-100'), 500);
                }
            }
        });
    });

    // Si quieres notificar cuántos se cambiaron, descomenta la siguiente línea:
    // if (propagatedCount > 0) console.log(`Propagated to ${propagatedCount} segments.`);
}

function applyGlossaryHighlightToText(text) {
    let highlightedHtml = text;
    const currentFoundTerms = new Set(); // Terms found in *this specific* segment

    // Ensure glossarySourceLanguage is set and matches the original's implicit language
    if (!state.glossarySourceLanguage) {
        return { html: text, foundTerms: currentFoundTerms }; // Cannot highlight without source language
    }

    // Sort glossary terms by length in descending order to match longer terms first
    const sortedGlossary = [...state.glossary].sort((a, b) => b.srcTerm.length - a.srcTerm.length);

    sortedGlossary.forEach((glossaryEntry) => {
        // Only highlight if the glossary entry's source language matches the current editor's source language
        // Assuming poEntries are implicitly in poanda's current source language.
        // For a more robust solution, each poEntry might need a source language field.
        // For now, we assume the glossary source language is the relevant source for highlighting.
        // Also, ensure the glossary entry has a source term.
        if (state.glossarySourceLanguage && glossaryEntry.srcTerm) {
            const term = glossaryEntry.srcTerm;
            // Use word boundaries \b to avoid partial word matches
            // Escape special regex characters in the term
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // 'g' for global, 'i' for case-insensitive
            const regex = new RegExp(`\\b(${escapedTerm})\\b`, 'gi'); // Added word boundaries

            // Only replace if the term is found (to avoid unnecessary string manipulations)
            if (highlightedHtml.match(regex)) {
                highlightedHtml = highlightedHtml.replace(regex, (match, p1) => {
                    // p1 is the captured group, which is the actual matched term (case-preserved)
                    currentFoundTerms.add(term); // Add the actual term from the glossary (case-preserved)
                    return `<span class="glossary-highlight">${p1}</span>`; // Highlight the matched part
                });
            }
        }
    });
    return { html: highlightedHtml, foundTerms: currentFoundTerms };
}

function updateGlossaryTableHighlights() {
    renderGlossary(); // Re-render glossary, which applies highlights based on termsFoundInActiveSegment
}

function renderTranslations(entries) {
    translationsContainer.innerHTML = '';
    state.termsFoundInActiveSegment.clear(); // Clear terms when re-rendering all translations
    state.lastFocusedSegment = null; // Reset AI context memory

    if (entries.length === 0) {
        translationsContainer.innerHTML = `
                    <div data-i18n="no_translations" id="initialMessage" class="text-center text-on-light-contrast p-4 border border-gray-300 rounded-md">
                        ${translations[state.currentLanguage]['no_translations']}
                    </div>
                `;
        savePoButton.disabled = true;
        convertToMoButton.disabled = true;
        poSearchContainer.classList.add('hidden'); // Hide search bar
        statsContainer.classList.remove('show'); // Hide stats if no translations
        updateUtilityButtonStates();
        updateSaveButtonsState(); // Sincronizar menú File
        return;
    }

    poSearchContainer.classList.remove('hidden'); // Show search bar

    entries.forEach((entry, entryIndex) => {
        // Skip rendering header entry explicitly in the main editor area, but keep in poEntries
        if (entry.isHeader) {
            return;
        }

        const translationUnit = document.createElement('div');
        translationUnit.id = `translation-unit-${entryIndex}`; // Added ID for highlighting
        translationUnit.className = 'translation-unit-bg p-4 rounded-lg shadow-sm border';

        if (entry.comments && entry.comments.length > 0) {
            const commentsDiv = document.createElement('div');
            commentsDiv.className = 'text-xs text-gray-500 mb-2 whitespace-pre-wrap';
            commentsDiv.textContent = entry.comments.join('\n');
            translationUnit.appendChild(commentsDiv);
        }
        if (entry.msgctxt) {
            const msgctxtLabel = document.createElement('label');
            msgctxtLabel.className = 'block text-sm font-medium text-on-light-contrast mb-1';
            msgctxtLabel.textContent = translations[state.currentLanguage]['context_msgctxt'];
            translationUnit.appendChild(msgctxtLabel);

            const msgctxtPre = document.createElement('pre');
            msgctxtPre.className =
                'po-display-code p-2 rounded-md text-base overflow-auto max-h-32';
            msgctxtPre.textContent = entry.msgctxt;
            translationUnit.appendChild(msgctxtPre);
        }

        entry.sentenceSegments.forEach((segment, segmentIndex) => {
            const segmentRow = document.createElement('div');
            segmentRow.className = 'translation-row mb-4';

            const originalCol = document.createElement('div');
            originalCol.className = 'original-col';

            const msgidLabel = document.createElement('label');
            msgidLabel.className = 'block text-sm font-medium text-on-light-contrast mb-1';
            msgidLabel.textContent = translations[state.currentLanguage]['original_msgid'];
            originalCol.appendChild(msgidLabel);

            const msgidPre = document.createElement('pre');
            msgidPre.id = `msgid-pre-${entryIndex}-${segmentIndex}`; // Added ID for easier lookup
            msgidPre.className = 'po-display-code p-2 rounded-md text-base overflow-auto max-h-32';
            msgidPre.textContent = segment.original; // Initial text without highlight
            originalCol.appendChild(msgidPre);
            segmentRow.appendChild(originalCol);

            const translationCol = document.createElement('div');
            translationCol.className = 'translation-col';

            // --- NUEVO: Contenedor de cabecera para Label + Etiqueta Amarilla ---
            const translationHeader = document.createElement('div');
            translationHeader.className = 'flex justify-between items-center mb-1';

            const msgstrLabel = document.createElement('label');
            msgstrLabel.className = 'block text-sm font-medium text-on-light-contrast';
            msgstrLabel.textContent = translations[state.currentLanguage]['translation_msgstr'];
            translationHeader.appendChild(msgstrLabel);

            // La etiqueta amarilla (oculta por defecto)
            const glossaryBadge = document.createElement('span');
            glossaryBadge.id = `glossary-match-${entryIndex}-${segmentIndex}`;
            glossaryBadge.className =
                'hidden flex items-center gap-1 text-xs font-semibold text-black bg-yellow-300 px-2 py-0.5 rounded-md whitespace-normal h-auto';
            translationHeader.appendChild(glossaryBadge);

            translationCol.appendChild(translationHeader);
            // --- FIN NUEVO BLOQUE ---

            const msgstrTextarea = document.createElement('textarea');
            msgstrTextarea.id = `msgstr-${entryIndex}-${segmentIndex}`;
            msgstrTextarea.className =
                'msgstr-textarea mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-red-500 focus:border-red-500 text-base';
            msgstrTextarea.value = segment.translation;
            msgstrTextarea.dataset.entryIndex = entryIndex;
            msgstrTextarea.dataset.segmentIndex = segmentIndex;
            msgstrTextarea.dataset.originalLength = segment.original.length;

            translationCol.appendChild(msgstrTextarea);
            segmentRow.appendChild(translationCol);
            translationUnit.appendChild(segmentRow);

            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'flex items-center justify-between mt-2 w-full';

            const charCountSpan = document.createElement('span');
            charCountSpan.id = `charCount-${entryIndex}-${segmentIndex}`;
            charCountSpan.className = 'inline-block text-sm font-semibold text-on-light-contrast';
            controlsContainer.appendChild(charCountSpan);

            const actionButtonsContainer = document.createElement('div');
            actionButtonsContainer.className = 'flex items-center space-x-2';

            const checkIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            checkIcon.setAttribute('id', `checkIcon-${entryIndex}-${segmentIndex}`);
            checkIcon.setAttribute('class', 'check-icon text-green-500');
            checkIcon.setAttribute('fill', 'none');
            checkIcon.setAttribute('viewBox', '0 0 24 24');
            checkIcon.setAttribute('stroke', 'currentColor');
            checkIcon.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    `;
            actionButtonsContainer.appendChild(checkIcon);

            // --- START: UPDATED COPY ORIGINAL BUTTON ---
            const copyOriginalButton = document.createElement('button');
            copyOriginalButton.id = `copyOriginalBtn-${entryIndex}-${segmentIndex}`;
            // Adjusted classes for padding with icon
            copyOriginalButton.className =
                'copy-original-button font-medium py-1 px-2 rounded-md shadow-sm transition duration-300 btn-modal-neutral';
            copyOriginalButton.dataset.entryIndex = entryIndex;
            copyOriginalButton.dataset.segmentIndex = segmentIndex;

            // Set tooltip text using the title attribute and translation key
            const tooltipText =
                translations[state.currentLanguage]['copy_original_btn'] || 'Copy Original';
            copyOriginalButton.setAttribute('title', tooltipText);

            // Set the button content to the SVG icon
            copyOriginalButton.innerHTML = copyIconSVG;

            actionButtonsContainer.appendChild(copyOriginalButton); // Add BEFORE validate button
            // --- END: UPDATED COPY ORIGINAL BUTTON ---

            const validateButton = document.createElement('button');
            validateButton.id = `validateBtn-${entryIndex}-${segmentIndex}`;
            validateButton.className =
                'validate-button font-medium py-1 px-3 rounded-md shadow-sm transition duration-300 btn-validate';
            validateButton.textContent = translations[state.currentLanguage]['validate'];
            validateButton.dataset.entryIndex = entryIndex;
            validateButton.dataset.segmentIndex = segmentIndex;
            actionButtonsContainer.appendChild(validateButton);

            const editButton = document.createElement('button');
            editButton.id = `editBtn-${entryIndex}-${segmentIndex}`;
            editButton.className =
                'edit-button font-medium py-1 px-3 rounded-md shadow-sm transition duration-300 btn-edit';
            editButton.textContent = translations[state.currentLanguage]['edit'];
            editButton.dataset.entryIndex = entryIndex;
            editButton.dataset.segmentIndex = segmentIndex;
            editButton.style.display = 'none';
            actionButtonsContainer.appendChild(editButton);

            controlsContainer.appendChild(actionButtonsContainer);
            translationUnit.appendChild(controlsContainer);

            // --- START: UPDATED EVENT LISTENER FOR COPY BUTTON ---
            copyOriginalButton.addEventListener('click', (event) => {
                // Use currentTarget to ensure we get the button, even if SVG is clicked
                const btn = event.currentTarget;
                const currentEntryIndex = parseInt(btn.dataset.entryIndex);
                const currentSegmentIndex = parseInt(btn.dataset.segmentIndex);
                const originalText =
                    state.poEntries[currentEntryIndex]?.sentenceSegments[currentSegmentIndex]
                        ?.original;
                const targetTextarea = document.getElementById(
                    `msgstr-${currentEntryIndex}-${currentSegmentIndex}`,
                );

                if (originalText !== undefined && targetTextarea && !targetTextarea.readOnly) {
                    pushToUndoStack();
                    // Paste original text into the translation textarea
                    targetTextarea.value = originalText;

                    // Trigger input event to update counts, stats, etc.
                    const inputEvent = new Event('input', { bubbles: true });
                    targetTextarea.dispatchEvent(inputEvent);

                    // Optional: Briefly focus the textarea
                    targetTextarea.focus();
                    // Optional: Move cursor to the end
                    targetTextarea.setSelectionRange(
                        targetTextarea.value.length,
                        targetTextarea.value.length,
                    );
                } else if (targetTextarea && targetTextarea.readOnly) {
                    // Optional: Inform user if textarea is read-only
                    showMessage(
                        translations[state.currentLanguage]['edit_first_message'] ||
                            'Click Edit first',
                    ); // Need a new translation string
                }
            });
            // --- END: UPDATED EVENT LISTENER ---

            // Variable para el temporizador (Debounce)
            let inputDebounceTimer;

            msgstrTextarea.addEventListener('input', (event) => {
                // --- A. ACCIONES VISUALES INMEDIATAS (Lo que el ojo ve) ---
                // Usamos la variable 'msgidPre' que ya existe en el ámbito,
                // en lugar de buscarla en el DOM con querySelector (más lento).
                autoResizeTextarea(event.target, msgidPre);

                const charCountSpan = document.getElementById(
                    `charCount-${entryIndex}-${segmentIndex}`,
                );
                updateCharCount(
                    event.target,
                    parseInt(event.target.dataset.originalLength),
                    charCountSpan,
                );

                // --- B. LÓGICA PESADA (Retardada 300ms) ---
                // Si el usuario sigue escribiendo, cancelamos el cálculo anterior
                clearTimeout(inputDebounceTimer);

                inputDebounceTimer = setTimeout(() => {
                    const currentEntryIndex = parseInt(event.target.dataset.entryIndex);
                    const currentSegmentIndex = parseInt(event.target.dataset.segmentIndex);
                    const segment =
                        state.poEntries[currentEntryIndex].sentenceSegments[currentSegmentIndex];

                    // 1. Guardar estado ANTERIOR
                    const oldWordCount = segment.wordCountTranslation;
                    const wasTranslated = segment.isTranslated;

                    // 2. Actualizar modelo con NUEVOS datos
                    const newText = event.target.value;
                    segment.translation = newText;
                    segment.wordCountTranslation = countWords(newText);
                    segment.isTranslated = newText.trim() !== '';

                    // 3. Cálculo Diferencial (Optimizado)
                    if (wasTranslated !== segment.isTranslated) {
                        updateStatsDisplay();
                    } else {
                        const diffWords = segment.wordCountTranslation - oldWordCount;
                        if (diffWords !== 0) {
                            const currentTotal = parseInt(wordsTranslated.textContent) || 0;
                            wordsTranslated.textContent = currentTotal + diffWords;
                        }
                        updateSaveButtonsState();
                    }
                }, 300); // Espera 300ms después de la última pulsación
            });

            msgstrTextarea.addEventListener('focus', (event) => {
                document.querySelectorAll('.translation-unit-active').forEach((unit) => {
                    unit.classList.remove('translation-unit-active');
                });
                state.lastFocusedSegment = { entryIndex, segmentIndex }; // Remember this segment for AI
                translationUnit.classList.add('translation-unit-active');

                state.termsFoundInActiveSegment.clear();
                const originalSegmentPre = document.getElementById(
                    `msgid-pre-${entryIndex}-${segmentIndex}`,
                );
                if (
                    originalSegmentPre &&
                    state.glossarySourceLanguage &&
                    state.glossary.length > 0
                ) {
                    const highlightResult = applyGlossaryHighlightToText(segment.original);
                    originalSegmentPre.innerHTML = highlightResult.html;
                    highlightResult.foundTerms.forEach((term) =>
                        state.termsFoundInActiveSegment.add(term),
                    );
                }

                // --- NUEVO: Mostrar etiqueta de glosario ---
                const glossaryMatchContainer = document.getElementById(
                    `glossary-match-${entryIndex}-${segmentIndex}`,
                );
                if (glossaryMatchContainer) {
                    glossaryMatchContainer.innerHTML = '';
                    glossaryMatchContainer.title = '';
                    glossaryMatchContainer.classList.add('hidden');

                    if (state.termsFoundInActiveSegment.size > 0) {
                        let hintText = '';
                        let fullHintText = '';

                        state.termsFoundInActiveSegment.forEach((foundTerm) => {
                            const glossaryEntry = state.glossary.find(
                                (g) => g.srcTerm === foundTerm,
                            );
                            if (glossaryEntry) {
                                const part = `${glossaryEntry.srcTerm} -> ${glossaryEntry.tgtTerm}`;
                                hintText += part + ' | ';
                                fullHintText += part + ' | ';
                            }
                        });

                        if (hintText) {
                            glossaryMatchContainer.innerHTML = `
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                                        <span>${hintText.slice(0, -3)}</span>
                                    `;
                            glossaryMatchContainer.title = `Glosario: ${fullHintText.slice(0, -3)}`;
                            glossaryMatchContainer.classList.remove('hidden');
                        }
                    }
                }
                // --- FIN NUEVO BLOQUE ---

                updateGlossaryTableHighlights();
                autoResizeTextarea(event.target, originalCol.querySelector('pre'));
                event.target.scrollIntoView({ behavior: 'smooth', block: 'center' });

                const currentSegmentOriginal =
                    state.poEntries[entryIndex].sentenceSegments[segmentIndex].original;
                state.tmBestMatchForActiveSegment = findBestTMMatch(currentSegmentOriginal);
                tmSearch();
            });

            msgstrTextarea.addEventListener('blur', (event) => {
                // 1. Disparar Autopropagación al salir del campo
                const currentEntryIndex = parseInt(event.target.dataset.entryIndex);
                const currentSegmentIndex = parseInt(event.target.dataset.segmentIndex);
                const segmentData =
                    state.poEntries[currentEntryIndex].sentenceSegments[currentSegmentIndex];

                // Llamamos a la función que creamos en el Paso 2
                performAutoPropagation(
                    segmentData.original,
                    event.target.value,
                    currentEntryIndex,
                    currentSegmentIndex,
                );
                // --- NUEVO: Ocultar etiqueta ---
                const glossaryMatchContainer = document.getElementById(
                    `glossary-match-${entryIndex}-${segmentIndex}`,
                );
                if (glossaryMatchContainer) {
                    glossaryMatchContainer.classList.add('hidden');
                    glossaryMatchContainer.innerHTML = '';
                }
                // --- FIN NUEVO BLOQUE ---

                const originalSegmentPre = document.getElementById(
                    `msgid-pre-${entryIndex}-${segmentIndex}`,
                );
                if (originalSegmentPre) {
                    originalSegmentPre.textContent = segment.original;
                }
                state.termsFoundInActiveSegment.clear();
                updateGlossaryTableHighlights();
                state.tmBestMatchForActiveSegment = null;
                tmSearch();
            });

            msgstrTextarea.addEventListener('click', (event) => {
                const currentEntryIndex = parseInt(event.target.dataset.entryIndex);
                const currentSegmentIndex = parseInt(event.target.dataset.segmentIndex);
                if (event.target.readOnly) {
                    setTranslationEditableState(currentEntryIndex, currentSegmentIndex, true);
                }
            });

            validateButton.addEventListener('click', (event) => {
                const currentEntryIndex = parseInt(event.target.dataset.entryIndex);
                const currentSegmentIndex = parseInt(event.target.dataset.segmentIndex);
                // Disparar Autopropagación al validar
                const txtArea = document.getElementById(
                    `msgstr-${currentEntryIndex}-${currentSegmentIndex}`,
                );
                const segOriginal =
                    state.poEntries[currentEntryIndex].sentenceSegments[currentSegmentIndex]
                        .original;
                performAutoPropagation(
                    segOriginal,
                    txtArea.value,
                    currentEntryIndex,
                    currentSegmentIndex,
                );
                setTranslationEditableState(currentEntryIndex, currentSegmentIndex, false);
                goToNextTranslation(currentEntryIndex, currentSegmentIndex);
            });

            editButton.addEventListener('click', (event) => {
                const currentEntryIndex = parseInt(event.target.dataset.entryIndex);
                const currentSegmentIndex = parseInt(event.target.dataset.segmentIndex);
                setTranslationEditableState(currentEntryIndex, currentSegmentIndex, true);
            });

            autoResizeTextarea(msgstrTextarea, msgidPre);
            updateCharCount(msgstrTextarea, segment.original.length, charCountSpan);
        });

        if (entry.fuzzy) {
            const fuzzyIndicator = document.createElement('span');
            fuzzyIndicator.className =
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-2';
            fuzzyIndicator.textContent = translations[state.currentLanguage]['fuzzy'];
            translationUnit.appendChild(fuzzyIndicator);
        }

        translationsContainer.appendChild(translationUnit);
    });
    savePoButton.disabled = false;
    convertToMoButton.disabled = false;
    statsContainer.classList.add('show');
    updateStatsDisplay();
    updateUtilityButtonStates();
    updateSaveButtonsState(); // Sincronizar menú File

    const firstEditableSegment = getFirstEditableSegment();
    if (firstEditableSegment) {
        navigateToTranslation(firstEditableSegment.entryIndex, firstEditableSegment.segmentIndex);
    }
}

function filterPOEntries() {
    const query = poSearchInput.value.trim();
    const searchInOriginal = searchInOriginalCheckbox.checked;
    const searchInTranslation = searchInTranslationCheckbox.checked;

    // Clear previous search state
    state.searchResults = [];
    state.currentSearchIndex = -1;
    document.querySelectorAll('.search-highlight, .current-search-highlight').forEach((el) => {
        const parent = el.parentNode;
        if (parent) {
            parent.innerHTML = parent.textContent; // Revert to plain text
        }
    });

    if (!query) {
        state.poEntries.forEach((entry, index) => {
            const unit = document.getElementById(`translation-unit-${index}`);
            if (unit) unit.style.display = 'block';
        });
        updateSearchCounter();
        return;
    }

    const queryRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    state.poEntries.forEach((entry, index) => {
        if (entry.isHeader) return;

        const unit = document.getElementById(`translation-unit-${index}`);
        if (!unit) return;

        let matchFound = false;
        const fullMsgstr = entry.sentenceSegments.map((s) => s.translation).join(' ');

        // Highlight in original
        if (searchInOriginal) {
            const msgidElements = unit.querySelectorAll('.original-col pre');
            msgidElements.forEach((el) => {
                const originalText = el.textContent;
                if (originalText.match(queryRegex)) {
                    matchFound = true;
                    el.innerHTML = originalText.replace(
                        queryRegex,
                        (match) => `<span class="search-highlight">${match}</span>`,
                    );
                }
            });
        }

        // Check for match in translation (without highlighting the textarea)
        if (searchInTranslation && fullMsgstr.match(queryRegex)) {
            matchFound = true;
        }

        unit.style.display = matchFound ? 'block' : 'none';
    });

    // Populate searchResults array with all new highlights
    state.searchResults = document.querySelectorAll('.search-highlight');
    updateSearchCounter();
}

function getCurrentFocusedIndex() {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.classList.contains('msgstr-textarea')) {
        return {
            entryIndex: parseInt(activeElement.dataset.entryIndex),
            segmentIndex: parseInt(activeElement.dataset.segmentIndex),
        };
    }
    return null;
}

function getFirstEditableSegment() {
    for (let i = 0; i < state.poEntries.length; i++) {
        const entry = state.poEntries[i];
        if (!entry.isHeader && entry.sentenceSegments && entry.sentenceSegments.length > 0) {
            return { entryIndex: i, segmentIndex: 0 };
        }
    }
    return null;
}

function navigateToTranslation(entryIndex, segmentIndex) {
    const targetTextarea = document.getElementById(`msgstr-${entryIndex}-${segmentIndex}`);
    if (targetTextarea) {
        const currentlyFocusedTextarea = document.activeElement;
        if (
            currentlyFocusedTextarea &&
            currentlyFocusedTextarea.classList.contains('msgstr-textarea') &&
            currentlyFocusedTextarea !== targetTextarea
        ) {
            currentlyFocusedTextarea.blur();
        }
        setTranslationEditableState(entryIndex, segmentIndex, true);
        targetTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function goToNextTranslation(currentEntryIndex, currentSegmentIndex) {
    if (state.poEntries.length === 0) return;

    let nextEntryIndex = currentEntryIndex;
    let nextSegmentIndex = currentSegmentIndex + 1;

    while (true) {
        if (nextEntryIndex >= state.poEntries.length) {
            showMessage(translations[state.currentLanguage]['reached_last']);
            return;
        }

        const currentEntry = state.poEntries[nextEntryIndex];
        if (
            currentEntry.isHeader ||
            !currentEntry.sentenceSegments ||
            currentEntry.sentenceSegments.length === 0
        ) {
            nextEntryIndex++;
            nextSegmentIndex = 0;
            continue;
        }

        if (nextSegmentIndex < currentEntry.sentenceSegments.length) {
            navigateToTranslation(nextEntryIndex, nextSegmentIndex);
            return;
        } else {
            nextEntryIndex++;
            nextSegmentIndex = 0;
        }
    }
}

function goToPreviousTranslation(currentEntryIndex, currentSegmentIndex) {
    if (state.poEntries.length === 0) return;

    let prevEntryIndex = currentEntryIndex;
    let prevSegmentIndex = currentSegmentIndex - 1;

    while (true) {
        if (prevEntryIndex < 0) {
            showMessage(translations[state.currentLanguage]['reached_first']);
            return;
        }

        const currentEntry = state.poEntries[prevEntryIndex];
        if (
            currentEntry.isHeader ||
            !currentEntry.sentenceSegments ||
            currentEntry.sentenceSegments.length === 0
        ) {
            prevEntryIndex--;
            prevSegmentIndex =
                prevEntryIndex >= 0 && state.poEntries[prevEntryIndex].sentenceSegments
                    ? state.poEntries[prevEntryIndex].sentenceSegments.length - 1
                    : 0;
            continue;
        }

        if (prevSegmentIndex >= 0) {
            navigateToTranslation(prevEntryIndex, prevSegmentIndex);
            return;
        } else {
            prevEntryIndex--;
            prevSegmentIndex =
                prevEntryIndex >= 0 && state.poEntries[prevEntryIndex].sentenceSegments
                    ? state.poEntries[prevEntryIndex].sentenceSegments.length - 1
                    : 0;
        }
    }
}

export {
    filterPOEntries,
    getCurrentFocusedIndex,
    goToNextTranslation,
    goToPreviousTranslation,
    navigateToTranslation,
    pushToUndoStack,
    renderTranslations,
    setTranslationEditableState,
};
