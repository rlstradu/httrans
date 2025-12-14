// wp-main.js - Lógica principal de WhisperPanda (V2.1 - Algoritmo Colab Portado & Debug)

const translations = {
    en: {
        backLink: "Back to HTTrans",
        heroDesc: "AI-powered automatic transcription and subtitling tool.",
        privacyBadge: "100% Private: Files never leave your device",
        settingsTitle: "Assistant Preferences",
        audioLangLabel: "Audio Language",
        audioLangHelp: "Manually selecting the language improves accuracy and speed.",
        optAuto: "✨ Detect automatically",
        actionLabel: "Action",
        optTranscribe: "Transcribe (Keep original language)",
        optTranslate: "Translate (Convert audio to English)",
        optSpotting: "Spotting (Empty subtitles)",
        gapLabel: "Min. Gap",
        unitFrames: "Frames",
        unitMs: "ms",
        minDurLabel: "Min Duration (s)",
        maxDurLabel: "Max Duration (s)",
        maxLinesLabel: "Max Lines",
        cplLabel: "Max chars/line (CPL)",
        punctuationLabel: "Force break on punctuation",
        dontBreakLabel: "Do not end line on (Prepositions)",
        dropTitle: "Click or drag your file here",
        dropSubtitle: "Supports MP3, WAV, MP4, MKV, MOV...",
        fileWarning: "<strong>Heads up!</strong> This file is large (>500MB). The browser might slow down. We recommend extracting audio to MP3 first if you experience issues.",
        startBtn: "Start",
        startBtnProcessing: "Processing audio (Wait)...",
        statusLoading: "Loading AI model (~250MB)...", 
        statusInitiating: "Initiating transcription...",
        statusListening: "The Panda is listening...",
        statusComplete: "Completed!",
        statusGenerating: "Generating subtitles...",
        resultTitle: "Result",
        copyBtn: "Copy",
        copiedBtn: "Copied!",
        saveSrtBtn: "Save SRT",
        saveTxtBtn: "Save TXT",
        resultFooter: "Remember to check subtitles in a professional tool (like Subpanda or EZTitles) for fine-tuning.",
        errorMsg: "Error processing audio. Ensure it's a valid format.",
        downloadModel: "Downloading Whisper Small (~250MB)...", 
        dontBreakDefaults: "of, to, in, for, with, on, at, by, from, about, as, into, like, through, after, over, between, out, against, during, without, before, under, around, among"
    },
    es: {
        backLink: "Volver a HTTrans",
        heroDesc: "Herramienta de transcripción y subtitulado automático impulsada por IA.",
        privacyBadge: "100% Privado: Tus archivos nunca salen de tu dispositivo",
        settingsTitle: "Ajustes del asistente",
        audioLangLabel: "Idioma del audio",
        audioLangHelp: "Seleccionar el idioma manualmente mejora la precisión y velocidad.",
        optAuto: "✨ Detectar automáticamente",
        actionLabel: "Acción",
        optTranscribe: "Transcribir (Mantener idioma original)",
        optTranslate: "Traducir (Convertir audio al Inglés)",
        optSpotting: "Spotting (Subtítulos vacíos)",
        gapLabel: "Intervalo Mín.",
        unitFrames: "Frames",
        unitMs: "ms",
        minDurLabel: "Duración Mín. (s)",
        maxDurLabel: "Duración Máx. (s)",
        maxLinesLabel: "Máx. Líneas",
        cplLabel: "Máx. caracteres/línea (CPL)",
        punctuationLabel: "Forzar corte en puntuación",
        dontBreakLabel: "No terminar línea en (Preposiciones)",
        dropTitle: "Haz clic o arrastra tu archivo aquí",
        dropSubtitle: "Soporta MP3, WAV, MP4, MKV, MOV...",
        fileWarning: "<strong>¡Ojo!</strong> Este archivo es grande (>500MB). El navegador podría ir lento. Recomendamos extraer el audio a MP3 antes de subirlo si experimentas problemas.",
        startBtn: "Iniciar",
        startBtnProcessing: "Procesando audio (Espere)...",
        statusLoading: "Cargando modelo de IA (~250MB)...", 
        statusInitiating: "Iniciando transcripción...",
        statusListening: "El Panda está escuchando...",
        statusComplete: "¡Completado!",
        statusGenerating: "Generando subtítulos...",
        resultTitle: "Resultado",
        copyBtn: "Copiar",
        copiedBtn: "¡Copiado!",
        saveSrtBtn: "Guardar SRT",
        saveTxtBtn: "Guardar TXT",
        resultFooter: "Recuerda revisar los subtítulos en una herramienta profesional (como Subpanda o EZTitles) para el ajuste fino de tiempos.",
        errorMsg: "No se pudo procesar el audio. Asegúrate de que es un formato válido.",
        downloadModel: "Descargando Whisper Small (~250MB)...", 
        dontBreakDefaults: "a, ante, bajo, cabe, con, contra, de, desde, en, entre, hacia, hasta, para, por, según, sin, so, sobre, tras, el, la, los, las, un, una, unos, unas"
    }
};

let currentLang = 'en';
let audioData = null;
let rawFileName = "subtitulos";
let audioDuration = 0;
// Instanciamos el Worker (asegúrate de que wp-worker.js esté actualizado a la versión V3)
let worker = new Worker('wp-worker.js', { type: 'module' });

const els = {
    langEn: document.getElementById('lang-en'),
    langEs: document.getElementById('lang-es'),
    fileInput: document.getElementById('file-input'),
    dropZone: document.getElementById('drop-zone'),
    fileInfo: document.getElementById('file-info'),
    fileName: document.getElementById('file-name'),
    removeFile: document.getElementById('remove-file'),
    warning: document.getElementById('file-warning'),
    runBtn: document.getElementById('run-btn'),
    progressCont: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar'),
    progressPercent: document.getElementById('progress-percentage'),
    statusText: document.getElementById('status-text'),
    detailText: document.getElementById('detail-text'),
    consoleOutput: document.getElementById('console-output'),
    resultsArea: document.getElementById('results-area'),
    outputText: document.getElementById('output-text'),
    dlSrt: document.getElementById('download-srt-btn'),
    dlTxt: document.getElementById('download-txt-btn'),
    copy: document.getElementById('copy-btn'),
    dontBreakInput: document.getElementById('dont-break-on')
};

// --- UTILS CONSOLA ---
function logToConsole(msg) {
    if (!els.consoleOutput) return;
    const div = document.createElement('div');
    // Si es un objeto, lo convertimos a string
    if (typeof msg === 'object') {
        div.innerText = `> ${JSON.stringify(msg)}`;
    } else {
        div.innerText = `> ${msg}`;
    }
    div.className = "hover:bg-gray-800 px-1 rounded";
    els.consoleOutput.appendChild(div);
    els.consoleOutput.scrollTop = els.consoleOutput.scrollHeight;
}

function updateProgress(percent) {
    const p = Math.min(100, Math.max(0, percent.toFixed(1)));
    if(els.progressBar) els.progressBar.style.width = `${p}%`;
    if(els.progressPercent) els.progressPercent.innerText = `${p}%`;
}

// --- IDIOMA ---
function setLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];

    if (lang === 'en') { els.langEn.classList.add('active'); els.langEs.classList.remove('active'); } 
    else { els.langEs.classList.add('active'); els.langEn.classList.remove('active'); }
    
    document.querySelectorAll('[data-key]').forEach(el => {
        if (t[el.dataset.key]) el.innerHTML = t[el.dataset.key];
    });

    if (els.runBtn.disabled && !audioData) els.runBtn.querySelector('span').innerText = t.startBtn;
    else if (!els.runBtn.disabled) els.runBtn.querySelector('span').innerText = t.startBtn;
    
    els.dontBreakInput.value = t.dontBreakDefaults;
}
els.langEn.addEventListener('click', () => setLanguage('en'));
els.langEs.addEventListener('click', () => setLanguage('es'));

// --- ARCHIVOS ---
function resetFile() {
    audioData = null;
    audioDuration = 0;
    els.fileInput.value = '';
    els.fileInfo.classList.add('hidden');
    els.warning.classList.add('hidden');
    els.runBtn.disabled = true;
    els.runBtn.querySelector('span').innerText = translations[currentLang].startBtn;
    if(els.consoleOutput) els.consoleOutput.innerHTML = '<div class="opacity-50">> System ready...</div>';
    updateProgress(0);
}

async function handleFile(file) {
    resetFile();
    const t = translations[currentLang];
    rawFileName = file.name.split('.').slice(0, -1).join('.');
    els.fileName.innerText = file.name;
    els.fileInfo.classList.remove('hidden');
    if (file.size > 500 * 1024 * 1024) els.warning.classList.remove('hidden');
    els.runBtn.querySelector('span').innerText = t.startBtnProcessing;
    logToConsole(`File loaded: ${file.name}`);
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioData = audioBuffer.getChannelData(0);
        audioDuration = audioBuffer.duration;
        logToConsole(`Audio decoded. Duration: ${fmtTime(audioDuration)}`);
        els.runBtn.disabled = false;
        els.runBtn.querySelector('span').innerText = t.startBtn;
    } catch (err) {
        logToConsole(`ERROR: ${err.message}`);
        resetFile();
    }
}
els.dropZone.addEventListener('click', () => els.fileInput.click());
els.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('border-[#E23B5D]', 'bg-pink-50'); });
els.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-[#E23B5D]', 'bg-pink-50'); });
els.dropZone.addEventListener('drop', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-[#E23B5D]', 'bg-pink-50'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
els.fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
els.removeFile.addEventListener('click', (e) => { e.stopPropagation(); resetFile(); });

// --- WORKER COMMS ---
worker.onmessage = (e) => {
    const { status, data } = e.data;
    const t = translations[currentLang];

    if (status === 'debug') {
        // Logs internos del worker (ayuda a ver qué pasa si se queda pillado)
        logToConsole(`[Worker] ${data}`);
    }
    else if (status === 'loading') {
        if (data && data.status === 'progress') {
            els.statusText.innerText = `${t.statusLoading} (${Math.round(data.progress)}%)`;
            if(Math.round(data.progress) % 20 === 0) logToConsole(`Downloading model: ${Math.round(data.progress)}%`);
        } else {
            els.statusText.innerText = t.statusLoading;
        }
    } else if (status === 'initiate') {
        els.statusText.innerText = t.statusInitiating;
        logToConsole("Running Whisper Small (WebGPU/WASM)...");
    } else if (status === 'progress') {
        // Data sanitizado: { text, timeRef }
        if (data && data.timeRef && audioDuration > 0) {
            const percent = (data.timeRef / audioDuration) * 100;
            updateProgress(percent);
            els.statusText.innerText = `${t.statusListening} (${Math.round(percent)}%)`;
            
            // Logueamos solo si ha avanzado significativamente para no saturar
            // o si queremos ver actividad
            // logToConsole(`Processing: ${fmtTime(data.timeRef)}`);
        }
    } else if (status === 'complete') {
        updateProgress(100);
        els.statusText.innerText = t.statusComplete;
        logToConsole("Raw transcription done. Applying Panda Logic V5...");
        processResultsV5(data); 
    } else if (status === 'error') {
        logToConsole(`ERROR: ${data}`);
        alert("Error: " + data);
        els.runBtn.disabled = false;
    }
};

els.runBtn.addEventListener('click', () => {
    if (!audioData) return;
    els.runBtn.disabled = true;
    els.resultsArea.classList.add('hidden');
    els.resultsArea.classList.remove('opacity-100');
    els.progressCont.classList.remove('hidden');
    updateProgress(0);
    els.consoleOutput.innerHTML = '';
    
    const langSelect = document.getElementById('language-select').value;
    const task = document.getElementById('task-select').value;
    
    worker.postMessage({
        type: 'run',
        audio: audioData,
        language: langSelect === 'auto' ? null : langSelect,
        task: task
    });
});


// =================================================================
// 🚀 MOTOR LÓGICO V5: PORT DE PYTHON A JAVASCRIPT
// =================================================================

function processResultsV5(data) {
    const maxCPL = parseInt(document.getElementById('max-cpl').value);
    const maxLines = parseInt(document.getElementById('max-lines').value);
    const minDurVal = parseFloat(document.getElementById('min-duration').value) || 1.0;
    const maxDurVal = parseFloat(document.getElementById('max-duration').value) || 7.0;
    const minGapVal = parseFloat(document.getElementById('min-gap-val').value) || 0;
    const minGapUnit = document.getElementById('min-gap-unit').value;
    
    let minGapSeconds = minGapUnit === 'frames' ? minGapVal * 0.040 : minGapVal / 1000;

    // 1. Extraer palabras con timestamps
    // Data viene sanitizado: { text, chunks: [{text, timestamp:[s,e]}] }
    let allWords = [];
    if (data.chunks && Array.isArray(data.chunks)) {
        data.chunks.forEach(chunk => {
            let start = chunk.timestamp[0];
            let end = chunk.timestamp[1];
            
            // Filtro básico de validez
            if (start !== null && end !== null && typeof start === 'number' && typeof end === 'number') {
                allWords.push({
                    word: chunk.text,
                    start: start,
                    end: end
                });
            }
        });
    }

    logToConsole(`Extracted ${allWords.length} words with timestamps.`);

    // 2. Segmentación Inteligente (Algoritmo Colab)
    let subs = createSrtV5(allWords, maxCPL, maxLines);
    
    // 3. Reglas de Tiempo (Algoritmo Colab)
    subs = applyTimeRules(subs, minDurVal, maxDurVal, minGapSeconds);

    // 4. Output
    const task = document.getElementById('task-select').value;
    if (task === 'spotting') {
        subs.forEach(s => s.text = "");
    }

    const srt = generateSRT(subs);
    els.outputText.value = srt;
    els.resultsArea.classList.remove('hidden');
    setTimeout(() => {
        els.resultsArea.classList.add('opacity-100');
        els.resultsArea.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    setupDownloads(srt, subs);
}

// --- PORT: segmentar_texto_equilibrado ---
function balancedSplit(text, maxCpl) {
    if (text.length <= maxCpl) return [text];

    const words = text.split(' ');
    let bestCut = -1;
    let bestDiff = Infinity;
    const punct = [',', ':', ';', '-', '.'];

    // Zona segura (30% - 70%)
    const safeStart = Math.floor(text.length * 0.3);
    const safeEnd = Math.floor(text.length * 0.7);

    // 1. Intentar cortar por puntuación
    let indices = [];
    for (let i = 0; i < text.length; i++) {
        if (punct.includes(text[i])) indices.push(i);
    }
    const candidates = indices.filter(i => i > safeStart && i < safeEnd);

    if (candidates.length > 0) {
        const center = text.length / 2;
        // Buscar el más cercano al centro
        const bestPunct = candidates.reduce((prev, curr) => 
            Math.abs(curr - center) < Math.abs(prev - center) ? curr : prev
        );

        const l1 = text.substring(0, bestPunct + 1).trim();
        const l2 = text.substring(bestPunct + 1).trim();

        if (l1.length <= maxCpl && l2.length <= maxCpl) {
            return [l1, l2];
        }
    }

    // 2. Equilibrio geométrico (Pyramid)
    for (let i = 1; i < words.length; i++) {
        const l1 = words.slice(0, i).join(' ');
        const l2 = words.slice(i).join(' ');

        if (l1.length > maxCpl || l2.length > maxCpl) continue;

        const diff = Math.abs(l1.length - l2.length);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestCut = i;
        }
    }

    if (bestCut !== -1) {
        return [words.slice(0, bestCut).join(' '), words.slice(bestCut).join(' ')];
    }

    // 3. Fallback: Corte bruto
    const mid = Math.floor(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

// --- PORT: crear_srt_v5 ---
function createSrtV5(words, maxCpl, maxLines) {
    const subtitles = [];
    let buffer = [];
    let startTime = null;
    const strongPunct = ['.', '?', '!', '♪'];

    for (let i = 0; i < words.length; i++) {
        const wObj = words[i];
        const wordText = wObj.word.trim();
        if (!wordText) continue;

        if (startTime === null) startTime = wObj.start;

        buffer.push(wordText);
        const currentText = buffer.join(' ');
        let forceCut = false;
        let pendingWord = null;
        let endTime = wObj.end;

        // Regla 1: Exceso de caracteres
        if (currentText.length > (maxCpl * maxLines)) {
            // Sacar la última palabra
            pendingWord = wObj;
            buffer.pop();
            forceCut = true;
            // El fin es el inicio de la palabra pendiente (aprox)
            endTime = wObj.start; 
        }
        // Regla 2: Puntuación fuerte en palabra ANTERIOR
        else if (buffer.length > 1) {
            const prevWord = buffer[buffer.length - 2];
            const lastChar = prevWord.slice(-1);
            if (strongPunct.includes(lastChar)) {
                pendingWord = wObj;
                buffer.pop();
                forceCut = true;
                endTime = wObj.start;
            }
        }

        if (forceCut || i === words.length - 1) {
            const finalBlock = buffer.join(' ');
            const lines = balancedSplit(finalBlock, maxCpl);
            
            subtitles.push({
                start: startTime,
                end: endTime,
                text: lines.join('\n')
            });

            buffer = [];
            startTime = null;

            if (pendingWord) {
                buffer.push(pendingWord.word.trim());
                startTime = pendingWord.start;
            }
        }
    }
    return subtitles;
}

// --- PORT: aplicar_reglas_tiempo_y_gap ---
function applyTimeRules(subs, minDur, maxDur, minGap) {
    // 1. Corrección de solapamientos y Max Dur
    for (let i = 0; i < subs.length; i++) {
        let current = subs[i];

        // A. Duración Máxima
        if ((current.end - current.start) > maxDur) {
            current.end = current.start + maxDur;
        }

        // B. Forzar Gap
        if (i < subs.length - 1) {
            let next = subs[i+1];
            let limit = next.start - minGap;

            if (current.end > limit) {
                current.end = limit;
            }
            // Seguridad
            if (current.end <= current.start) {
                current.end = current.start + 0.1;
            }
        }
    }

    // 2. Duración mínima (Extender)
    for (let i = 0; i < subs.length; i++) {
        let current = subs[i];
        let duration = current.end - current.start;

        if (duration < minDur) {
            let desiredEnd = current.start + minDur;
            let limit = Infinity;
            
            if (i < subs.length - 1) {
                limit = subs[i+1].start - minGap;
            }

            if (desiredEnd <= limit) {
                current.end = desiredEnd;
            } else {
                current.end = limit;
            }
        }
    }
    return subs;
}

// --- UTILIDADES ---
function generateSRT(segs) {
    return segs.map((s, i) => `${i+1}\n${fmtTime(s.start)} --> ${fmtTime(s.end)}\n${s.text}\n`).join('\n');
}

function fmtTime(s) {
    if (typeof s !== 'number' || isNaN(s)) return "00:00:00,000";
    const d = new Date(s * 1000);
    return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')},${String(d.getUTCMilliseconds()).padStart(3,'0')}`;
}

function setupDownloads(srt, segs) {
    const t = translations[currentLang];
    els.dlSrt.onclick = () => download(srt, `${rawFileName}_subpanda.srt`);
    const cleanTxt = segs.map(s => s.text.replace(/\n/g, ' ')).join(' ');
    els.dlTxt.onclick = () => download(cleanTxt, `${rawFileName}.txt`);
    els.copy.onclick = () => {
        navigator.clipboard.writeText(srt);
        const orig = els.copy.querySelector('span').innerHTML;
        els.copy.querySelector('span').innerHTML = t.copiedBtn;
        setTimeout(() => els.copy.querySelector('span').innerHTML = orig, 2000);
    };
}

function download(content, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], {type: 'text/plain'}));
    a.download = name;
    a.click();
}

const obs = new MutationObserver((muts) => {
    muts.forEach((m) => {
        if (m.type === "attributes" && m.attributeName === "disabled") {
            if (!els.runBtn.disabled) {
                els.runBtn.classList.remove('bg-gray-300', 'cursor-not-allowed');
                els.runBtn.classList.add('bg-[#E23B5D]', 'hover:bg-[#c0304d]', 'hover:scale-[1.02]', 'cursor-pointer');
            } else {
                els.runBtn.classList.add('bg-gray-300', 'cursor-not-allowed');
                els.runBtn.classList.remove('bg-[#E23B5D]', 'hover:bg-[#c0304d]', 'hover:scale-[1.02]', 'cursor-pointer');
            }
        }
    });
});
obs.observe(els.runBtn, { attributes: true });

setLanguage('en');
