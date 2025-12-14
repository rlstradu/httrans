// wp-main.js - Lógica Híbrida (Groq + Local) v3.2

const translations = {
    en: {
        backLink: "Back to HTTrans",
        heroDesc: "AI-powered automatic transcription and subtitling tool.",
        privacyBadge: "100% Private: Files never leave your device",
        settingsTitle: "Assistant Preferences",
        audioLangLabel: "Audio Language",
        audioLangHelp: "Manually selecting the language improves accuracy.",
        modelLabel: "AI Model / Quality",
        modelHelp: "Local uses your PC. Cloud (Groq) uses API for speed.",
        modeLabel: "Processing Mode",
        modeLocalDesc: "Free, Private, Slower (CPU/GPU)",
        modeGroqDesc: "Ultra Fast, Best Quality, Requires Key",
        optTiny: "Tiny (Fastest - ~40MB)",
        optBase: "Base (Balanced - ~80MB)",
        optSmall: "Small (High Quality - ~250MB)",
        optDistil: "Distil-Small (English Only)",
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
        fileWarning: "<strong>Heads up!</strong> Large file. Browser might slow down.",
        startBtn: "Start",
        startBtnProcessing: "Processing...",
        statusLoading: "Loading...",
        statusInitiating: "Initializing...",
        statusListening: "Processing...",
        statusComplete: "Completed!",
        resultTitle: "Result",
        copyBtn: "Copy",
        copiedBtn: "Copied!",
        saveSrtBtn: "Save SRT",
        saveTxtBtn: "Save TXT",
        resultFooter: "Remember to check subtitles in a professional tool.",
        errorMsg: "Error processing audio.",
        downloadModel: "Downloading Model...",
        dontBreakDefaults: "of, to, in, for, with, on, at, by, from, about, as, into, like, through, after, over, between, out, against, during, without, before, under, around, among"
    },
    es: {
        backLink: "Volver a HTTrans",
        heroDesc: "Herramienta de transcripción y subtitulado automático impulsada por IA.",
        privacyBadge: "100% Privado: Tus archivos nunca salen de tu dispositivo",
        settingsTitle: "Ajustes del asistente",
        audioLangLabel: "Idioma del audio",
        audioLangHelp: "Seleccionar el idioma manualmente mejora la precisión.",
        modelLabel: "Modelo IA / Calidad",
        modelHelp: "Local usa tu PC. Nube (Groq) usa API para velocidad.",
        modeLabel: "Modo de Procesamiento",
        modeLocalDesc: "Gratis, Privado, Más lento (CPU/GPU)",
        modeGroqDesc: "Ultra Rápido, Mejor Calidad, Requiere Key",
        optTiny: "Tiny (Rápido - ~40MB)",
        optBase: "Base (Equilibrado - ~80MB)",
        optSmall: "Small (Mejor Calidad - ~250MB)",
        optDistil: "Distil-Small (Solo Inglés)",
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
        fileWarning: "<strong>¡Ojo!</strong> Archivo grande. El navegador podría ir lento.",
        startBtn: "Iniciar",
        startBtnProcessing: "Procesando...",
        statusLoading: "Cargando...",
        statusInitiating: "Iniciando...",
        statusListening: "Procesando...",
        statusComplete: "¡Completado!",
        resultTitle: "Resultado",
        copyBtn: "Copiar",
        copiedBtn: "¡Copiado!",
        saveSrtBtn: "Guardar SRT",
        saveTxtBtn: "Guardar TXT",
        resultFooter: "Recuerda revisar los subtítulos en una herramienta profesional.",
        errorMsg: "No se pudo procesar el audio.",
        downloadModel: "Descargando Modelo...",
        dontBreakDefaults: "a, ante, bajo, cabe, con, contra, de, desde, en, entre, hacia, hasta, para, por, según, sin, so, sobre, tras, el, la, los, las, un, una, unos, unas"
    }
};

let currentLang = 'en';
let audioData = null; // AudioBuffer
let rawFileName = "subtitulos";
let audioDuration = 0;
let worker = new Worker('wp-worker.js', { type: 'module' });
let startTime = 0;
let lastConsoleLine = null;

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
    statusText: document.getElementById('status-text'),
    consoleOutput: document.getElementById('console-output'),
    resultsArea: document.getElementById('results-area'),
    outputText: document.getElementById('output-text'),
    dlSrt: document.getElementById('download-srt-btn'),
    dlTxt: document.getElementById('download-txt-btn'),
    copy: document.getElementById('copy-btn'),
    dontBreakInput: document.getElementById('dont-break-on'),
    modeRadios: document.getElementsByName('proc_mode'),
    groqContainer: document.getElementById('groq-key-container'),
    localModelContainer: document.getElementById('local-model-container')
};

// --- LOGICA DE MODOS ---
function updateModeUI(mode) {
    if (mode === 'groq') {
        els.groqContainer.classList.remove('hidden');
        els.localModelContainer.classList.add('opacity-50', 'pointer-events-none');
        
        // Estilos visuales de selección
        document.querySelectorAll('input[name="proc_mode"]').forEach(r => {
            const label = r.closest('label');
            if (r.checked) {
                label.classList.add('border-[#E23B5D]', 'shadow-md');
                label.classList.remove('border-gray-200');
            } else {
                label.classList.remove('border-[#E23B5D]', 'shadow-md');
                label.classList.add('border-gray-200');
            }
        });

        // Cargar key guardada o usar la por defecto
        const savedKey = localStorage.getItem('groq_api_key');
        const defaultKey = "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";
        if(document.getElementById('groq-key')) {
             document.getElementById('groq-key').value = savedKey || defaultKey;
        }
    } else {
        els.groqContainer.classList.add('hidden');
        els.localModelContainer.classList.remove('opacity-50', 'pointer-events-none');
        
        document.querySelectorAll('input[name="proc_mode"]').forEach(r => {
            const label = r.closest('label');
            if (r.checked) {
                label.classList.add('border-gray-400', 'shadow-md');
                label.classList.remove('border-gray-200');
            } else {
                label.classList.remove('border-gray-400', 'shadow-md');
                label.classList.add('border-gray-200');
            }
        });
    }
}

// Inicializar estado de modo
updateModeUI('groq');

els.modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => updateModeUI(e.target.value));
});

// --- UTILS CONSOLA ---
function logToConsole(msg, isProgress = false) {
    if (!els.consoleOutput) return;
    if (!isProgress) lastConsoleLine = null;
    const div = document.createElement('div');
    div.innerText = typeof msg === 'object' ? `> ${JSON.stringify(msg)}` : `> ${msg}`;
    div.className = "hover:bg-gray-800 px-1 rounded font-mono text-xs";
    if (isProgress) div.style.color = "#a7f3d0";
    els.consoleOutput.appendChild(div);
    els.consoleOutput.scrollTop = els.consoleOutput.scrollHeight;
}

function updateConsoleLine(msg) {
    if (!els.consoleOutput) return;
    if (lastConsoleLine && lastConsoleLine.isConnected) {
        lastConsoleLine.innerText = `> ${msg}`;
    } else {
        const div = document.createElement('div');
        div.innerText = `> ${msg}`;
        div.className = "hover:bg-gray-800 px-1 rounded text-green-300 font-bold font-mono text-xs";
        els.consoleOutput.appendChild(div);
        lastConsoleLine = div;
    }
    els.consoleOutput.scrollTop = els.consoleOutput.scrollHeight;
}

function getAsciiBar(percent) {
    const width = 20;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return "[" + "=".repeat(filled) + ">".repeat(filled < width ? 1 : 0) + ".".repeat(Math.max(0, empty - (filled < width ? 1 : 0))) + "]";
}

function fmtDuration(seconds) {
    if(!seconds || seconds < 0) return "0s";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
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
    
    // Actualizar opciones del select
    const modelSelect = document.getElementById('model-select');
    if(modelSelect) {
        modelSelect.options[0].text = t.optTiny;
        modelSelect.options[1].text = t.optBase;
        modelSelect.options[2].text = t.optSmall;
        if(modelSelect.options[3]) modelSelect.options[3].text = t.optDistil;
    }

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
}

async function handleFile(file) {
    resetFile();
    const t = translations[currentLang];
    rawFileName = file.name.split('.').slice(0, -1).join('.');
    els.fileName.innerText = file.name;
    els.fileInfo.classList.remove('hidden');
    if (file.size > 500 * 1024 * 1024) els.warning.classList.remove('hidden'); // Warning para 500MB
    els.runBtn.querySelector('span').innerText = t.startBtnProcessing;
    logToConsole(`File loaded: ${file.name}`);
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioData = audioBuffer; // Guardamos el AudioBuffer completo
        audioDuration = audioBuffer.duration;
        logToConsole(`Audio decoded. Duration: ${fmtDuration(audioDuration)}`);
        
        // Habilitar botón lógica
        els.runBtn.disabled = false;
        
        // FIX VISUAL: Forzar actualización de estilos para que el botón se vea activo
        els.runBtn.classList.remove('bg-gray-300', 'cursor-not-allowed');
        els.runBtn.classList.add('bg-[#E23B5D]', 'hover:bg-[#c0304d]', 'hover:scale-[1.02]', 'cursor-pointer');
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

// --- UTILS AUDIO ---
// Convierte AudioBuffer a WAV Blob para enviar a Groq
function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new ArrayBuffer(length);
    const view = new DataView(out);
    const channels = [];
    let i, sample, offset = 0, pos = 0;

    // write WAVE header
    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(length - pos - 4);

    for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

    return new Blob([out], { type: 'audio/wav' });
}

// --- EJECUCIÓN ---
els.runBtn.addEventListener('click', async () => {
    if (!audioData) return;
    
    const mode = document.querySelector('input[name="proc_mode"]:checked').value;
    const langSelect = document.getElementById('language-select').value;
    const task = document.getElementById('task-select').value;
    
    // UI Setup
    els.runBtn.disabled = true;
    els.resultsArea.classList.add('hidden');
    els.resultsArea.classList.remove('opacity-100');
    els.progressCont.classList.remove('hidden');
    els.consoleOutput.innerHTML = '';
    
    if (mode === 'groq') {
        const apiKey = document.getElementById('groq-key').value.trim();
        if (!apiKey) {
            alert("Please enter a Groq API Key.");
            els.runBtn.disabled = false;
            return;
        }
        localStorage.setItem('groq_api_key', apiKey); // Guardar para futuro
        await runGroq(apiKey, audioData, langSelect, task);
    } else {
        // MODO LOCAL
        logToConsole("Panda Local Mode Started.");
        const modelSelect = document.getElementById('model-select').value;
        const channelData = audioData.getChannelData(0); // Worker espera Float32Array
        
        worker.postMessage({
            type: 'run',
            audio: channelData,
            language: langSelect === 'auto' ? null : langSelect,
            task: task,
            model: modelSelect
        });
    }
});

// --- LÓGICA GROQ ---
async function runGroq(apiKey, audioBuffer, language, task) {
    logToConsole("Panda Cloud Mode (Groq) Started.");
    logToConsole("Encoding audio to WAV for upload...");
    
    try {
        const wavBlob = audioBufferToWav(audioBuffer);
        logToConsole(`Audio prepared (${(wavBlob.size/1024/1024).toFixed(2)} MB). Sending to Groq...`);
        
        const formData = new FormData();
        formData.append('file', wavBlob, 'audio.wav');
        formData.append('model', 'whisper-large-v3'); // Modelo Top de Groq
        if (language !== 'auto') formData.append('language', language);
        if (task === 'translate') formData.append('response_format', 'verbose_json'); // Groq translate
        else formData.append('response_format', 'verbose_json'); // Siempre verbose para timestamps
        
        // Groq soporta timestamp_granularities=word para obtener palabras
        formData.append('timestamp_granularities[]', 'word');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "API Error");
        }

        logToConsole("Groq API Response received! Processing...");
        const result = await response.json();
        
        // Adaptar respuesta de Groq al formato que espera processResultsV5
        // Groq verbose_json tiene .words o .segments
        let chunks = [];
        
        if (result.words) {
            chunks = result.words.map(w => ({
                text: w.word,
                timestamp: [w.start, w.end]
            }));
        } else if (result.segments) {
            // Fallback si no hay palabras
            result.segments.forEach(s => {
                chunks.push({
                    text: s.text,
                    timestamp: [s.start, s.end]
                });
            });
        }

        const data = {
            text: result.text,
            chunks: chunks
        };

        logToConsole("Applying V5 Segmentation...");
        processResultsV5(data);
        
        els.statusText.innerText = "Completed!";
        updateConsoleLine(`${getAsciiBar(100)} 100% | DONE (GROQ)`);
        els.runBtn.disabled = false;

    } catch (error) {
        logToConsole(`GROQ ERROR: ${error.message}`);
        alert(`Groq API Error: ${error.message}`);
        els.runBtn.disabled = false;
    }
}

// --- WORKER LISTENER (LOCAL) ---
worker.onmessage = (e) => {
    const { status, data } = e.data;
    const t = translations[currentLang];

    if (status === 'debug') { logToConsole(data); } 
    else if (status === 'loading') {
        if (data && data.status === 'progress') {
            const percent = Math.round(data.progress || 0);
            updateConsoleLine(`Downloading Model: ${getAsciiBar(percent)} ${percent}%`);
            els.statusText.innerText = `${t.statusLoading} (${percent}%)`;
        } else { els.statusText.innerText = t.statusLoading; }
    } 
    else if (status === 'initiate') {
        els.statusText.innerText = t.statusInitiating;
        lastConsoleLine = null;
        logToConsole("Initializing Local Whisper Engine...");
        startTime = Date.now(); 
        updateConsoleLine(`${getAsciiBar(0)} 0% | ETA: Calc...`);
    } 
    else if (status === 'progress') {
        if (data && typeof data.timeRef === 'number' && audioDuration > 0) {
            const current = data.timeRef;
            const percent = Math.min(100, Math.max(0, (current / audioDuration) * 100));
            const elapsed = (Date.now() - startTime) / 1000;
            let etaText = "Calc...";
            if (elapsed > 1 && current > 0) { 
                const rate = current / elapsed;
                const remaining = audioDuration - current;
                etaText = `ETA: ${fmtDuration(remaining / rate)}`;
            }
            els.statusText.innerText = `${t.statusListening} ${Math.round(percent)}%`;
            updateConsoleLine(`${getAsciiBar(percent)} ${Math.round(percent)}% | ${etaText}`);
        }
    } 
    else if (status === 'complete') {
        els.statusText.innerText = t.statusComplete;
        lastConsoleLine = null;
        updateConsoleLine(`${getAsciiBar(100)} 100% | DONE`);
        logToConsole("Transcription done. Processing...");
        processResultsV5(data);
        els.runBtn.disabled = false;
    } 
    else if (status === 'error') {
        logToConsole(`ERROR: ${data}`);
        alert("Error: " + data);
        els.runBtn.disabled = false;
    }
};

// =================================================================
// 🚀 MOTOR LÓGICO V5 (COMPARTIDO LOCAL Y GROQ)
// =================================================================

function processResultsV5(data) {
    const maxCPL = parseInt(document.getElementById('max-cpl').value);
    const maxLines = parseInt(document.getElementById('max-lines').value);
    const minDurVal = parseFloat(document.getElementById('min-duration').value) || 1.0;
    const maxDurVal = parseFloat(document.getElementById('max-duration').value) || 7.0;
    const minGapVal = parseFloat(document.getElementById('min-gap-val').value) || 0;
    const minGapUnit = document.getElementById('min-gap-unit').value;
    let minGapSeconds = minGapUnit === 'frames' ? minGapVal * 0.040 : minGapVal / 1000;

    let allWords = [];
    if (data.chunks && Array.isArray(data.chunks)) {
        data.chunks.forEach(chunk => {
            let start = chunk.timestamp[0];
            let end = chunk.timestamp[1];
            if (start !== null && end !== null) {
                allWords.push({ word: chunk.text, start: start, end: end });
            }
        });
    }

    logToConsole(`Extracted ${allWords.length} words.`);
    let subs = createSrtV5(allWords, maxCPL, maxLines);
    subs = applyTimeRules(subs, minDurVal, maxDurVal, minGapSeconds);

    const task = document.getElementById('task-select').value;
    if (task === 'spotting') subs.forEach(s => s.text = "");

    const srt = generateSRT(subs);
    els.outputText.value = srt;
    els.resultsArea.classList.remove('hidden');
    setTimeout(() => {
        els.resultsArea.classList.add('opacity-100');
        els.resultsArea.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    setupDownloads(srt, subs);
}

// ... (Resto de funciones: balancedSplit, createSrtV5, applyTimeRules, generateSRT, setupDownloads, download - SON IGUALES QUE ANTES) ...
// Para ahorrar espacio, asumo que las copias del archivo anterior, ya que son idénticas.
// Si las necesitas de nuevo, dímelo.

function balancedSplit(text, maxCpl) {
    if (text.length <= maxCpl) return [text];
    const words = text.split(' ');
    let bestCut = -1;
    let bestDiff = Infinity;
    const punct = [',', ':', ';', '-', '.'];
    const safeStart = Math.floor(text.length * 0.3);
    const safeEnd = Math.floor(text.length * 0.7);
    let indices = [];
    for (let i = 0; i < text.length; i++) { if (punct.includes(text[i])) indices.push(i); }
    const candidates = indices.filter(i => i > safeStart && i < safeEnd);
    if (candidates.length > 0) {
        const center = text.length / 2;
        const bestPunct = candidates.reduce((prev, curr) => Math.abs(curr - center) < Math.abs(prev - center) ? curr : prev);
        const l1 = text.substring(0, bestPunct + 1).trim();
        const l2 = text.substring(bestPunct + 1).trim();
        if (l1.length <= maxCpl && l2.length <= maxCpl) return [l1, l2];
    }
    for (let i = 1; i < words.length; i++) {
        const l1 = words.slice(0, i).join(' ');
        const l2 = words.slice(i).join(' ');
        if (l1.length > maxCpl || l2.length > maxCpl) continue;
        const diff = Math.abs(l1.length - l2.length);
        if (diff < bestDiff) { bestDiff = diff; bestCut = i; }
    }
    if (bestCut !== -1) return [words.slice(0, bestCut).join(' '), words.slice(bestCut).join(' ')];
    const mid = Math.floor(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

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
        if (currentText.length > (maxCpl * maxLines)) {
            pendingWord = wObj;
            buffer.pop();
            forceCut = true;
            endTime = wObj.start; 
        } else if (buffer.length > 1) {
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
            subtitles.push({ start: startTime, end: endTime, text: lines.join('\n') });
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

function applyTimeRules(subs, minDur, maxDur, minGap) {
    for (let i = 0; i < subs.length; i++) {
        let current = subs[i];
        if ((current.end - current.start) > maxDur) current.end = current.start + maxDur;
        if (i < subs.length - 1) {
            let next = subs[i+1];
            let limit = next.start - minGap;
            if (current.end > limit) current.end = limit;
            if (current.end <= current.start) current.end = current.start + 0.1;
        }
    }
    for (let i = 0; i < subs.length; i++) {
        let current = subs[i];
        let duration = current.end - current.start;
        if (duration < minDur) {
            let desiredEnd = current.start + minDur;
            let limit = Infinity;
            if (i < subs.length - 1) limit = subs[i+1].start - minGap;
            if (desiredEnd <= limit) current.end = desiredEnd;
            else current.end = limit;
        }
    }
    return subs;
}

function generateSRT(segs) {
    return segs.map((s, i) => `${i+1}\n${fmtTime(s.start)} --> ${fmtTime(s.end)}\n${s.text}\n`).join('\n');
}

function fmtTime(s) {
    if (typeof s !== 'number' || isNaN(s)) return "00:00:00,000";
    const d = new Date(s * 1000);
    return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')},${String(d.getUTCMilliseconds()).padStart(3,'0')}`;
}

function setupDownloads(srt, segs) {
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

setLanguage('en');
