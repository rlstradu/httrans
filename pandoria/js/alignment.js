// js/alignment.js
// The text-alignment feature: paste or upload source/target text (or SRT
// subtitles), align them line-by-line into a TM, and the mismatched-line
// wizard for when the two sides don't have the same number of lines.

// --- Funcionalidad de Alineación ---
function showAlignmentView() {
    if (translationMemory.length > 0) {
        showConfirmDialog(
            translations[currentLanguage]['confirm_align_title'],
            translations[currentLanguage]['confirm_align_text'],
            displayAlignmentSection
        );
    } else {
        displayAlignmentSection();
    }
}

function displayAlignmentSection() {
    languageConfigSection.style.display = 'none';
    editorSection.classList.add('hidden');
    alignmentSection.classList.remove('hidden');
    translationMemory = [];
    historyStack = [];
    updateUndoButton();
    sourceTextArea.value = '';
    targetTextArea.value = '';
    sourceFileName.textContent = '';
    targetFileName.textContent = '';
    sourceFileInput.value = '';
    targetFileInput.value = '';
    saveBackup();
}

async function handleAlignmentFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    if (type === 'src') sourceFileName.textContent = file.name;
    if (type === 'tgt') targetFileName.textContent = file.name;

    const extension = file.name.split('.').pop().toLowerCase();
    const content = await file.text();

    try {
        let segments;
        if (extension === 'srt') {
            segments = parseSRT(content);
        } else if (extension === 'txt') {
            segments = parseTXT(content);
        } else {
            showMessage(translations[currentLanguage]['unsupported_format']);
            return;
        }

        if (type === 'src') {
            sourceTextArea.value = segments.join('\n');
        } else {
            targetTextArea.value = segments.join('\n');
        }
        saveBackup();
    } catch (error) {
        showMessage(`${translations[currentLanguage]['file_read_error']}: ${error.message}`);
        console.error(error);
    }
}

function performAlignment() {
    const srcText = sourceTextArea.value.trim();
    const tgtText = targetTextArea.value.trim();
    const srcLang = alignSrcLang.value;
    const tgtLang = alignTgtLang.value;

    if (!srcText || !tgtText || !srcLang || !tgtLang) {
        showMessage(translations[currentLanguage]['enter_lang_codes']);
        return;
    }

    const srcSegments = srcText.split('\n');
    const tgtSegments = tgtText.split('\n');

    if (srcSegments.length !== tgtSegments.length) {
        openAlignmentWizard();
        return;
    }

    tmSourceLanguage = srcLang;
    tmTargetLanguage = tgtLang;
    displaySrcLangSpan.textContent = tmSourceLanguage;
    displayTgtLangSpan.textContent = tmTargetLanguage;

    translationMemory = srcSegments.map((src, index) => ({
        id: generateEntryId(),
        srcText: src.trim(),
        tgtText: (tgtSegments[index] || '').trim()
    })).filter(entry => entry.srcText || entry.tgtText);

    historyStack = [];
    updateUndoButton();
    alignmentSection.classList.add('hidden');
    editorSection.classList.remove('hidden');
    renderTM(translationMemory, false);
    saveBackup();
}

// --- Asistente de Alineación ---
function openAlignmentWizard() {
    alignmentWizardModal.style.display = 'flex';
    renderWizard();
}

function renderWizard() {
    const srcSegments = sourceTextArea.value.split('\n');
    const tgtSegments = targetTextArea.value.split('\n');

    wizardSourceColumn.innerHTML = '';
    wizardActionsColumn.innerHTML = '';
    wizardTargetColumn.innerHTML = '';

    const maxLines = Math.max(srcSegments.length, tgtSegments.length);

    for (let i = 0; i < maxLines; i++) {
        // Columna de Origen
        const srcSegment = srcSegments[i] !== undefined ? srcSegments[i] : '';
        const srcDiv = document.createElement('div');
        srcDiv.className = 'wizard-segment';
        srcDiv.setAttribute('contenteditable', 'true');
        srcDiv.textContent = srcSegment;
        srcDiv.oninput = (e) => updateWizardText('src', i, e.target.textContent);
        wizardSourceColumn.appendChild(srcDiv);

        // Columna de Acciones
        const actionDiv = document.createElement('div');
        actionDiv.className = 'wizard-actions';
        if (i > 0) {
            actionDiv.innerHTML += `<button class="wizard-action-btn" title="Unir con anterior" onclick="mergeLine('src', ${i})">↑</button>`;
        }
        actionDiv.innerHTML += `<button class="wizard-action-btn" title="Añadir línea vacía en destino" onclick="insertEmptyLine('tgt', ${i})">+</button>`;
        actionDiv.innerHTML += `<button class="wizard-action-btn" title="Añadir línea vacía en origen" onclick="insertEmptyLine('src', ${i})">+</button>`;
        if (i > 0) {
            actionDiv.innerHTML += `<button class="wizard-action-btn" title="Unir con anterior" onclick="mergeLine('tgt', ${i})">↑</button>`;
        }
        wizardActionsColumn.appendChild(actionDiv);

        // Columna de Destino
        const tgtSegment = tgtSegments[i] !== undefined ? tgtSegments[i] : '';
        const tgtDiv = document.createElement('div');
        tgtDiv.className = 'wizard-segment';
        tgtDiv.setAttribute('contenteditable', 'true');
        tgtDiv.textContent = tgtSegment;
        tgtDiv.oninput = (e) => updateWizardText('tgt', i, e.target.textContent);
        wizardTargetColumn.appendChild(tgtDiv);
    }
}

function updateWizardText(type, index, newText) {
    const textarea = type === 'src' ? sourceTextArea : targetTextArea;
    let lines = textarea.value.split('\n');
    if (index < lines.length) {
        lines[index] = newText;
        textarea.value = lines.join('\n');
    }
    saveBackup();
}

function mergeLine(type, index) {
    const textarea = type === 'src' ? sourceTextArea : targetTextArea;
    let lines = textarea.value.split('\n');
    if (index > 0 && index < lines.length) {
        lines[index - 1] = lines[index - 1] + ' ' + lines[index];
        lines.splice(index, 1);
        textarea.value = lines.join('\n');
        renderWizard();
        saveBackup();
    }
}

function insertEmptyLine(type, index) {
    const textarea = type === 'src' ? sourceTextArea : targetTextArea;
    let lines = textarea.value.split('\n');
    lines.splice(index, 0, '');
    textarea.value = lines.join('\n');
    renderWizard();
    saveBackup();
}

// --- Parsers para Alineación ---
function parseSRT(content) {
    const normalizedContent = content.replace(/\r\n/g, '\n');
    return normalizedContent.split(/\n\s*\n/)
        .map(block => {
            if (!block.trim()) return null;
            const lines = block.split('\n');
            const textLines = lines.filter(line => !/^\d+$/.test(line.trim()) && !line.includes('-->'));
            return textLines.join(' ').trim();
        })
        .filter(segment => segment);
}

function parseTXT(content) {
    return content.split('\n').filter(line => line.trim() !== '');
}
